#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HDTypes.h"
#include "HDSubsystems.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHDOnVibration, FVector, Location, float, Strength, AActor*, Source);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHDOnRealmChanged, EHDRealm, NewRealm);

/**
 * Everything that shakes the ground reports here: footsteps, strikes, stamps, heavy breathing.
 * The Listening Coil listens to it; bind OnVibration in Blueprint to spawn Niagara ground ripples.
 */
UCLASS()
class HOLLOWDEEP_API UHDVibrationSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Hollow Deep|Vibration")
	void ReportVibration(FVector Location, float Strength, AActor* Source);

	UPROPERTY(BlueprintAssignable, Category = "Hollow Deep|Vibration")
	FHDOnVibration OnVibration;
};

/** Which realm this world currently counts as. Set by AHDRealmMarker or AHDSinkhole. */
UCLASS()
class HOLLOWDEEP_API UHDRealmSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Hollow Deep|Realm")
	void SetRealm(EHDRealm NewRealm);

	UFUNCTION(BlueprintPure, Category = "Hollow Deep|Realm")
	EHDRealm GetRealm() const { return Realm; }

	UPROPERTY(BlueprintAssignable, Category = "Hollow Deep|Realm")
	FHDOnRealmChanged OnRealmChanged;

private:
	EHDRealm Realm = EHDRealm::BrightField;
};
