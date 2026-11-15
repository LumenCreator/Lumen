#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HDTypes.h"
#include "HDDayCycleDirector.generated.h"

class ADirectionalLight;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHDOnDayPhaseChanged, EHDDayPhase, NewPhase);

/**
 * Real-time days: 16 real hours = 8 day + 2 sunset + 6 night.
 * Drop one in the Bright Field level and point Sun (and optionally Moon) at the level's
 * directional lights. Both lights must be Movable. Raise TimeScale while testing
 * (960 = a whole day in one minute).
 */
UCLASS()
class HOLLOWDEEP_API AHDDayCycleDirector : public AActor
{
	GENERATED_BODY()

public:
	AHDDayCycleDirector();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

	UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category = "Day Cycle")
	TObjectPtr<ADirectionalLight> Sun;

	UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category = "Day Cycle")
	TObjectPtr<ADirectionalLight> Moon;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Day Cycle")
	float DayHours = 8.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Day Cycle")
	float SunsetHours = 2.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Day Cycle")
	float NightHours = 6.f;

	/** Hour of the cycle to start at. 0 = sunrise, 8 = sunset begins, 10 = night begins. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Day Cycle")
	float StartHour = 2.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Day Cycle", meta = (ClampMin = "0"))
	float TimeScale = 1.f;

	/** Compass direction the sun rises from. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Day Cycle")
	float SunYaw = -30.f;

	UPROPERTY(BlueprintAssignable, Category = "Day Cycle")
	FHDOnDayPhaseChanged OnPhaseChanged;

	UFUNCTION(BlueprintPure, Category = "Day Cycle")
	float GetCycleHours() const { return DayHours + SunsetHours + NightHours; }

	UFUNCTION(BlueprintPure, Category = "Day Cycle")
	float GetHourOfCycle() const;

	UFUNCTION(BlueprintPure, Category = "Day Cycle")
	EHDDayPhase GetPhase() const;

	/** Whole in-world days elapsed, for the on-screen counter. Not saved between sessions yet. */
	UFUNCTION(BlueprintPure, Category = "Day Cycle")
	int32 GetDaysElapsed() const;

	/** The late-game time-skip item calls this. */
	UFUNCTION(BlueprintCallable, Category = "Day Cycle")
	void SkipHours(float Hours);

private:
	double ElapsedSeconds = 0.0;
	EHDDayPhase LastPhase = EHDDayPhase::Day;

	void ApplySun();
};
