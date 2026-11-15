#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/HUD.h"
#include "HDGameMode.generated.h"

/** Spawns AHDCharacter and the placeholder HUD. Make a Blueprint child to swap in BP_HDCharacter. */
UCLASS()
class HOLLOWDEEP_API AHDGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AHDGameMode();
};

/**
 * Placeholder HUD drawn with plain rectangles and text so the slice is testable before any UI art:
 * health, stamina, tonic timer, day counter, the Coil's state and vibration meter, heartbeat prompt.
 * Hidden in sightseeing mode. Replace with a UMG widget later.
 */
UCLASS()
class HOLLOWDEEP_API AHDDebugHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

private:
	void DrawBar(float X, float Y, float Width, float Fraction, const FLinearColor& Color, const FString& Label);
};
