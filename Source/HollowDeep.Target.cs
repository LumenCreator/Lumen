using UnrealBuildTool;

public class HollowDeepTarget : TargetRules
{
	public HollowDeepTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("HollowDeep");
	}
}
