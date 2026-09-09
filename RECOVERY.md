# Recovering a Claude Code project after deleting its folder

If a Claude Code chat shows:

> **Folder not found** — This session's working folder no longer exists.
> Choose a different folder or start a new session.

the conversation itself is almost certainly fine. Claude Code stores transcripts
in `~/.claude/projects/`, which is a **separate location from your project
folder**. Deleting the project does not delete the transcript, and the
transcript contains the full text of every file Claude wrote.

## Quickest fix: recreate the folder

The error is just a check that the working directory still exists. Recreate it
at the same path and the stranded chat opens again with its history intact:

```bash
mkdir -p "/path/to/the/folder/that/was/deleted"
```

Then reopen that chat. Nothing else is needed if you only want to keep talking.

## Getting your files back

`claude_project_recover.py` (in this repo, standard library only) replays the
`Write`, `Edit` and `MultiEdit` calls from a transcript in order and writes out
the resulting files. Files that Claude only *read* are recovered too, from the
tool results.

```bash
# 1. See every session and which folders are missing
python3 claude_project_recover.py list

# 2. Recreate a missing folder (unsticks the chat)
python3 claude_project_recover.py restore <session-id>

# 3. Rebuild the files into ~/claude-recovered/<session-id>/
python3 claude_project_recover.py files <session-id>

# 4. Save the conversation as readable Markdown
python3 claude_project_recover.py export <session-id>
```

`<session-id>` may be an id prefix or any part of the folder path. Omit it and
the most recent session with a missing folder is used. If you keep your config
somewhere non-standard, set `CLAUDE_CONFIG_DIR` first.

## Caveats

- Reconstruction replays the conversation, so **edits you made by hand outside
  Claude are not captured**, and neither are binary files or anything created by
  a build step. Review the output before trusting it.
- An `Edit` whose target text isn't present in the reconstruction is skipped
  rather than applied wrongly, so a file may be missing a late change.
- `~/.claude/projects/` is subject to a retention window (default 30 days), so
  do this sooner rather than later. Back the directory up before experimenting.

## Other places to look

- **The trash / Recycle Bin** — a deleted folder is often still there, and that
  copy is byte-exact, unlike a replay.
- **Time Machine (macOS) / File History (Windows)**, or any cloud sync such as
  iCloud, Dropbox or OneDrive, which usually keep deleted-file history.
- **`git reflog`** in any surviving clone, if the project was a git repo.
- Your editor's local history (VS Code: *Timeline* in the Explorer panel;
  JetBrains: *Local History*), which is independent of git.
