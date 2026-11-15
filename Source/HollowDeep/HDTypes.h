#pragma once

#include "CoreMinimal.h"
#include "HDTypes.generated.h"

UENUM(BlueprintType)
enum class EHDRealm : uint8
{
	BrightField,
	Underside
};

UENUM(BlueprintType)
enum class EHDDayPhase : uint8
{
	Day,
	Sunset,
	Night
};

UENUM(BlueprintType)
enum class EHDCoilState : uint8
{
	Rising,       // head up, swaying; players move freely
	Listening,    // jaw on the ground; vibration fills the meter
	Lunging,      // striking the spot where it felt you
	Stuck,        // head buried; the only time it takes damage
	Pressing,     // body touched a player; heartbeat minigame running
	Constricting, // minigame failed; crushing until the player breaks free
	Dead
};

/** Magic colour follows the build: 90 Holy + 10 Nature = 90% white, 10% green. */
USTRUCT(BlueprintType)
struct FHDMagicBuild
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Magic", meta = (ClampMin = "0"))
	float Holy = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Magic", meta = (ClampMin = "0"))
	float Nature = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Magic", meta = (ClampMin = "0"))
	float Void = 0.f;

	float Total() const { return FMath::Max(Holy + Nature + Void, KINDA_SMALL_NUMBER); }
	float HolyFraction() const { return Holy / Total(); }

	FLinearColor GetBlendedColor() const
	{
		const FLinearColor HolyColor(1.f, 1.f, 1.f);
		const FLinearColor NatureColor(0.2f, 1.f, 0.35f);
		const FLinearColor VoidColor(0.45f, 0.1f, 0.9f);
		return (HolyColor * Holy + NatureColor * Nature + VoidColor * Void) / Total();
	}
};
