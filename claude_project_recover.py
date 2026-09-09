#!/usr/bin/env python3
"""Recover a Claude Code project whose working folder was deleted.

Claude Code stores conversation transcripts under ~/.claude/projects/, which is
a completely separate location from your project folder. Deleting the project
folder does not delete the transcript, so the conversation -- including the full
text of every file Claude wrote -- usually survives.

Commands:
  list      Show every recorded session and whether its folder still exists.
  restore   Recreate a missing folder so the stranded chat opens again.
  files     Rebuild the files Claude wrote/edited into an output directory.
  export    Write the conversation out as readable Markdown.

Run with no arguments for `list`. Python 3.8+, standard library only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

TEXT_LIMIT = 4000


def projects_root() -> Path:
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    if env:
        return Path(env).expanduser() / "projects"
    return Path.home() / ".claude" / "projects"


def read_records(path: Path):
    """Yield JSON records, skipping blank or corrupt lines."""
    with path.open("r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def unslug(name: str) -> str:
    """Best-effort reverse of the folder-name encoding (only used as a fallback)."""
    if re.match(r"^-[A-Za-z]--", name):  # windows: C--Users-x -> C:\Users\x
        return name[1] + ":\\" + name[4:].replace("-", "\\")
    return "/" + name.lstrip("-").replace("-", "/")


def blocks(message) -> list:
    """Normalize a message's content to a list of blocks."""
    if not isinstance(message, dict):
        return []
    content = message.get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    if isinstance(content, list):
        return [b for b in content if isinstance(b, dict)]
    return []


class Session:
    def __init__(self, path: Path):
        self.path = path
        self.cwd = None
        self.branch = None
        self.first_prompt = None
        self.started = None
        self.ended = None
        self.user_turns = 0
        self.assistant_turns = 0
        self.written = set()
        self._scan()

    def _scan(self) -> None:
        for rec in read_records(self.path):
            if not self.cwd and isinstance(rec.get("cwd"), str):
                self.cwd = rec["cwd"]
            if not self.branch and rec.get("gitBranch"):
                self.branch = rec["gitBranch"]
            ts = rec.get("timestamp")
            if ts:
                self.started = self.started or ts
                self.ended = ts
            rtype = rec.get("type")
            if rtype == "user":
                self.user_turns += 1
                if self.first_prompt is None:
                    for b in blocks(rec.get("message")):
                        text = b.get("text")
                        if b.get("type") == "text" and isinstance(text, str):
                            text = text.strip()
                            # skip harness-injected noise
                            if text and not text.startswith(
                                ("<system-reminder", "<local-command", "<command-name")
                            ):
                                self.first_prompt = " ".join(text.split())[:160]
                                break
            elif rtype == "assistant":
                self.assistant_turns += 1
                for b in blocks(rec.get("message")):
                    if b.get("type") == "tool_use" and b.get("name") in (
                        "Write",
                        "Edit",
                        "MultiEdit",
                        "NotebookEdit",
                    ):
                        fp = (b.get("input") or {}).get("file_path")
                        if isinstance(fp, str):
                            self.written.add(fp)
        if not self.cwd:
            self.cwd = unslug(self.path.parent.name)

    @property
    def folder_exists(self) -> bool:
        try:
            return Path(self.cwd).is_dir()
        except OSError:
            return False

    @property
    def session_id(self) -> str:
        return self.path.stem

    def when(self) -> str:
        for stamp in (self.ended, self.started):
            if stamp:
                try:
                    return datetime.fromisoformat(
                        stamp.replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d %H:%M")
                except ValueError:
                    return stamp[:16]
        try:
            return datetime.fromtimestamp(self.path.stat().st_mtime).strftime(
                "%Y-%m-%d %H:%M"
            )
        except OSError:
            return "unknown"


def find_sessions(root: Path) -> list:
    if not root.is_dir():
        return []
    found = [Session(p) for p in sorted(root.glob("*/*.jsonl"))]
    found.sort(key=lambda s: s.ended or "", reverse=True)
    return found


# --------------------------------------------------------------------------- #
# file reconstruction
# --------------------------------------------------------------------------- #


def apply_edit(current: str, params: dict) -> str:
    old = params.get("old_string")
    new = params.get("new_string", "")
    if not isinstance(old, str) or not isinstance(new, str):
        return current
    if old == "":
        return new if current is None else current + new
    if old not in current:
        return current  # edit doesn't apply to what we reconstructed; keep going
    if params.get("replace_all"):
        return current.replace(old, new)
    return current.replace(old, new, 1)


def strip_line_numbers(text: str) -> str:
    """Read results arrive as `cat -n` style: spaces, number, tab, content."""
    lines = text.split("\n")
    stripped, hits = [], 0
    for line in lines:
        m = re.match(r"^\s*\d+\t(.*)$", line)
        if m:
            hits += 1
            stripped.append(m.group(1))
        else:
            stripped.append(line)
    return "\n".join(stripped) if hits > len(lines) * 0.5 else text


def read_tool_result(rec: dict):
    """Pull (path, content) out of a Read tool result, if this record has one."""
    result = rec.get("toolUseResult")
    if not isinstance(result, dict):
        return None
    file_info = result.get("file")
    if isinstance(file_info, dict):
        path, content = file_info.get("filePath"), file_info.get("content")
        if isinstance(path, str) and isinstance(content, str):
            return path, strip_line_numbers(content)
    return None


def rebuild_files(session: Session) -> dict:
    """Replay Write/Edit calls chronologically to reconstruct final file contents."""
    files: dict = {}
    pending: dict = {}

    for rec in read_records(session.path):
        rtype = rec.get("type")

        if rtype == "assistant":
            for b in blocks(rec.get("message")):
                if b.get("type") != "tool_use":
                    continue
                name = b.get("name")
                params = b.get("input") or {}
                path = params.get("file_path")
                if not isinstance(path, str):
                    continue

                if name == "Write":
                    content = params.get("content")
                    if isinstance(content, str):
                        files[path] = content
                elif name == "Edit":
                    files[path] = apply_edit(files.get(path, ""), params)
                elif name == "MultiEdit":
                    current = files.get(path, "")
                    for edit in params.get("edits") or []:
                        if isinstance(edit, dict):
                            current = apply_edit(current, edit)
                    files[path] = current
                elif name == "Read":
                    # remember which tool_use id maps to which path
                    tid = b.get("id")
                    if tid:
                        pending[tid] = path

        elif rtype == "user":
            got = read_tool_result(rec)
            if got:
                path, content = got
                # a Read only fills in a file we never saw written
                files.setdefault(path, content)

    return files


def write_out(files: dict, out_dir: Path, base: str) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for path, content in sorted(files.items()):
        rel = path
        if base and rel.startswith(base):
            rel = rel[len(base):]
        rel = rel.lstrip("/\\")
        rel = re.sub(r"^[A-Za-z]:[\\/]", "", rel)
        rel = rel.replace("..", "_")
        if not rel:
            continue
        target = out_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        count += 1
    return count


# --------------------------------------------------------------------------- #
# markdown export
# --------------------------------------------------------------------------- #


def export_markdown(session: Session, out: Path) -> None:
    lines = [
        f"# Claude Code transcript — {session.session_id}",
        "",
        f"- Folder: `{session.cwd}`" + ("" if session.folder_exists else "  **(deleted)**"),
        f"- Branch: `{session.branch}`" if session.branch else "",
        f"- Last activity: {session.when()}",
        f"- Turns: {session.user_turns} user / {session.assistant_turns} assistant",
        "",
        "---",
        "",
    ]

    for rec in read_records(session.path):
        rtype = rec.get("type")
        if rtype not in ("user", "assistant"):
            continue
        role = "You" if rtype == "user" else "Claude"
        chunks = []
        for b in blocks(rec.get("message")):
            btype = b.get("type")
            if btype == "text" and isinstance(b.get("text"), str):
                text = b["text"].strip()
                if text.startswith(("<system-reminder", "<local-command")):
                    continue
                if text:
                    chunks.append(text)
            elif btype == "tool_use":
                params = b.get("input") or {}
                label = b.get("name", "tool")
                detail = (
                    params.get("file_path")
                    or params.get("command")
                    or params.get("pattern")
                    or ""
                )
                detail = " ".join(str(detail).split())[:200]
                chunks.append(f"`[{label}]` {detail}".rstrip())
        if not chunks:
            continue
        body = "\n\n".join(chunks)
        if len(body) > TEXT_LIMIT:
            body = body[:TEXT_LIMIT] + "\n\n*…truncated…*"
        lines.append(f"### {role}")
        lines.append("")
        lines.append(body)
        lines.append("")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(l for l in lines if l is not None), encoding="utf-8")


# --------------------------------------------------------------------------- #
# commands
# --------------------------------------------------------------------------- #


def pick(sessions: list, wanted: str):
    if not wanted:
        missing = [s for s in sessions if not s.folder_exists]
        pool = missing or sessions
        if not pool:
            return None
        return pool[0]
    for s in sessions:
        if s.session_id == wanted or s.session_id.startswith(wanted):
            return s
    for s in sessions:
        if wanted in (s.cwd or ""):
            return s
    return None


def cmd_list(sessions: list) -> int:
    if not sessions:
        print(f"No transcripts found under {projects_root()}")
        print("If you use a custom config dir, set CLAUDE_CONFIG_DIR and retry.")
        return 1

    missing = [s for s in sessions if not s.folder_exists]
    print(f"Found {len(sessions)} session(s); {len(missing)} with a missing folder.\n")

    for s in sessions:
        mark = "OK     " if s.folder_exists else "MISSING"
        print(f"[{mark}] {s.when()}  {s.session_id}")
        print(f"           folder: {s.cwd}")
        if s.first_prompt:
            print(f"           opened: {s.first_prompt}")
        if s.written:
            print(f"           files touched: {len(s.written)}")
        print()

    if missing:
        top = missing[0]
        print("Next steps for the most recent missing folder:")
        print(f"  python3 {Path(sys.argv[0]).name} restore {top.session_id}")
        print(f"  python3 {Path(sys.argv[0]).name} files   {top.session_id}")
        print(f"  python3 {Path(sys.argv[0]).name} export  {top.session_id}")
    return 0


def cmd_restore(session: Session) -> int:
    target = Path(session.cwd)
    if target.is_dir():
        print(f"Folder already exists: {target}")
        return 0
    target.mkdir(parents=True, exist_ok=True)
    print(f"Recreated: {target}")
    print("Reopen that chat in Claude Code -- the 'Folder not found' error should")
    print("be gone and the full conversation history will still be there.")
    return 0


def cmd_files(session: Session, out_dir: Path) -> int:
    files = rebuild_files(session)
    if not files:
        print("No file contents found in this transcript.")
        print("(Claude may not have written files, or they predate the transcript.)")
        return 1
    written = write_out(files, out_dir, session.cwd or "")
    print(f"Reconstructed {written} file(s) into {out_dir}\n")
    for path in sorted(files):
        print(f"  {len(files[path]):>8} bytes  {path}")
    print("\nReview these before trusting them: they are replayed from the")
    print("conversation, so any edit you made by hand outside Claude is not included.")
    return 0


def cmd_export(session: Session, out: Path) -> int:
    export_markdown(session, out)
    print(f"Wrote transcript to {out}")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Recover a Claude Code project whose folder was deleted.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="list",
        choices=["list", "restore", "files", "export"],
    )
    parser.add_argument(
        "session",
        nargs="?",
        default="",
        help="session id (or prefix), or part of the folder path. "
        "Defaults to the most recent session with a missing folder.",
    )
    parser.add_argument("--out", help="output path for `files` / `export`")
    args = parser.parse_args(argv)

    sessions = find_sessions(projects_root())

    if args.command == "list":
        return cmd_list(sessions)

    if not sessions:
        print(f"No transcripts found under {projects_root()}")
        return 1

    session = pick(sessions, args.session)
    if session is None:
        print(f"No session matched {args.session!r}. Run `list` to see them all.")
        return 1

    print(f"Session {session.session_id}  ({session.cwd})\n")

    if args.command == "restore":
        return cmd_restore(session)
    if args.command == "files":
        default = Path.home() / "claude-recovered" / session.session_id
        return cmd_files(session, Path(args.out) if args.out else default)
    if args.command == "export":
        default = (
            Path.home() / "claude-recovered" / f"{session.session_id}.md"
        )
        return cmd_export(session, Path(args.out) if args.out else default)
    return 1


if __name__ == "__main__":
    sys.exit(main())
