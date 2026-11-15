using UnrealBuildTool;

public class HollowDeepEditorTarget : TargetRules
{
	public HollowDeepEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("HollowDeep");
	}
}
