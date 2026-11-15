#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HDTypes.h"
#include "HDWorldActors.generated.h"

class USphereComponent;
class UBoxComponent;
class USplineComponent;
class AHDCharacter;

/** Something on the ground you walk over to collect: a sunpetal, or the tonic you dropped when you died. */
UCLASS()
class HOLLOWDEEP_API AHDPickup : public AActor
{
	GENERATED_BODY()

public:
	AHDPickup();
	virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Pickup")
	TObjectPtr<USphereComponent> Trigger;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Pickup")
	FName ItemId = TEXT("Sunpetal");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Pickup")
	int32 Count = 1;
};

/** Brews the Coldblood Tonic in exchange for gathered materials. Press E nearby. */
UCLASS()
class HOLLOWDEEP_API AHDHerbalist : public AActor
{
	GENERATED_BODY()

public:
	AHDHerbalist();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Herbalist")
	FName RequiredItem = TEXT("Sunpetal");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Herbalist")
	int32 RequiredCount = 3;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Herbalist")
	float InteractRange = 300.f;

	UFUNCTION(BlueprintCallable, Category = "Herbalist")
	bool Interact(AHDCharacter* Character);

	/** bBrewed is false when the player is still short of materials. */
	UFUNCTION(BlueprintImplementableEvent, Category = "Herbalist")
	void OnInteracted(AHDCharacter* Character, bool bBrewed);
};

/** Place one in each level (or each half of a shared level) to say which realm it is. */
UCLASS()
class HOLLOWDEEP_API AHDRealmMarker : public AActor
{
	GENERATED_BODY()

public:
	AHDRealmMarker();
	virtual void BeginPlay() override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Realm")
	EHDRealm Realm = EHDRealm::BrightField;
};

/**
 * The hidden hole in the flowers. Either opens another level (DestinationLevel) or,
 * if both realms live in one level, teleports to DestinationActor.
 */
UCLASS()
class HOLLOWDEEP_API AHDSinkhole : public AActor
{
	GENERATED_BODY()

public:
	AHDSinkhole();
	virtual void NotifyActorBeginOverlap(AActor* OtherActor) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Sinkhole")
	TObjectPtr<UBoxComponent> Trigger;

	/** Level to open, e.g. L_Underside. Leave empty to use DestinationActor instead. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sinkhole")
	FName DestinationLevel;

	UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category = "Sinkhole")
	TObjectPtr<AActor> DestinationActor;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sinkhole")
	EHDRealm DestinationRealm = EHDRealm::Underside;

	UFUNCTION(BlueprintImplementableEvent, Category = "Sinkhole")
	void OnFellThrough(AHDCharacter* Character);
};

/** The footpath. Sightseeing mode autowalks along this spline. */
UCLASS()
class HOLLOWDEEP_API AHDSightseeingPath : public AActor
{
	GENERATED_BODY()

public:
	AHDSightseeingPath();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Sightseeing")
	TObjectPtr<USplineComponent> Spline;
};
