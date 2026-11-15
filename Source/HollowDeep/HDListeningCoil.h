#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HDTypes.h"
#include "HDListeningCoil.generated.h"

class USphereComponent;
class UPointLightComponent;
class UInstancedStaticMeshComponent;
class AHDCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHDOnCoilStateChanged, EHDCoilState, NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FHDOnCoilDefeated);

/**
 * The Listening Coil: a blind serpent that hunts by vibration, scent and touch.
 * Red light, green light: move while it is Rising, freeze while it is Listening,
 * bait a Lunge, hit the weak point while it is Stuck.
 *
 * The body here is a chain of placeholder spheres so the fight is playable with no art.
 * Swap it for a rigged serpent later (see docs/UNREAL_PLAN.md); the logic does not change.
 * Place it on a flat arena floor: it moves in the plane it was spawned on.
 */
UCLASS()
class HOLLOWDEEP_API AHDListeningCoil : public AActor
{
	GENERATED_BODY()

public:
	AHDListeningCoil();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// ---- Components
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<USphereComponent> Head;

	/** Glows only while Stuck. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UPointLightComponent> WeakPointGlow;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UInstancedStaticMeshComponent> BodySegments;

	// ---- Tuning
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil")
	float MaxHealth = 300.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Timing")
	float RisingDuration = 6.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Timing")
	float ListenDuration = 5.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Timing")
	float StuckDuration = 3.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Movement")
	float MoveSpeed = 450.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Movement")
	float LungeSpeed = 3500.f;

	/** It wanders within this distance of where it was placed. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Movement")
	float ArenaRadius = 3000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Movement")
	float HeadRaisedHeight = 500.f;

	/** The meter value that triggers a lunge. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Listening")
	float VibrationThreshold = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Listening")
	float MeterDecayPerSecond = 0.25f;

	/** Vibration is felt at full strength inside this distance... */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Listening")
	float FullHearingRange = 1500.f;

	/** ...and fades to 30% at this distance. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Listening")
	float FarHearingRange = 6000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Damage")
	float LungeDamage = 45.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Damage")
	float LungeRadius = 300.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Damage")
	float CrushDamagePerSecond = 12.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Body")
	int32 SegmentCount = 40;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Body")
	float SegmentSpacing = 150.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Body")
	float BodyRadius = 110.f;

	/** After a heartbeat touch it ignores that player's touch for this long. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Body")
	float TouchImmunitySeconds = 8.f;

	/** Below half health it listens this much longer and moves this much faster. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Phase 2")
	float Phase2ListenMultiplier = 1.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Coil|Phase 2")
	float Phase2SpeedMultiplier = 1.4f;

	// ---- Events
	UPROPERTY(BlueprintAssignable, Category = "Coil")
	FHDOnCoilStateChanged OnStateChanged;

	/** Fires when it dies and starts sinking through the floor. Open the way down here. */
	UPROPERTY(BlueprintAssignable, Category = "Coil")
	FHDOnCoilDefeated OnDefeated;

	UFUNCTION(BlueprintImplementableEvent, Category = "Coil")
	void OnLungeImpact(FVector Location);

	// ---- Queries
	UFUNCTION(BlueprintPure, Category = "Coil")
	EHDCoilState GetState() const { return State; }

	UFUNCTION(BlueprintPure, Category = "Coil")
	float GetHealth() const { return Health; }

	/** 0..1, how close it is to lunging. Drives the vibration meter UI. */
	UFUNCTION(BlueprintPure, Category = "Coil")
	float GetVibrationFraction() const { return FMath::Clamp(Meter / FMath::Max(VibrationThreshold, 0.01f), 0.f, 1.f); }

	UFUNCTION(BlueprintPure, Category = "Coil")
	bool IsPhaseTwo() const { return Health <= MaxHealth * 0.5f; }

	// Called by UHDHeartbeatComponent.
	void NotifyHeartbeatResult(AHDCharacter* Character, bool bSuccess);
	void NotifyBrokeFree(AHDCharacter* Character);

private:
	EHDCoilState State = EHDCoilState::Rising;
	float StateTime = 0.f;
	float Health = 300.f;
	float Meter = 0.f;
	float WanderTimer = 0.f;
	FVector Origin = FVector::ZeroVector;
	FVector WanderGoal = FVector::ZeroVector;
	FVector LastVibrationLocation = FVector::ZeroVector;
	FVector LungeTarget = FVector::ZeroVector;
	TArray<FVector> Segments;
	TWeakObjectPtr<AHDCharacter> HeldCharacter;
	TMap<TWeakObjectPtr<AHDCharacter>, float> TouchImmuneUntil;

	UFUNCTION()
	void HandleVibration(FVector Location, float Strength, AActor* Source);

	void SetState(EHDCoilState NewState);
	void TickRising(float DeltaTime);
	void TickLunging(float DeltaTime);
	void MoveHeadToward(const FVector& Goal, float Speed, float DeltaTime, float StopDistance);
	void UpdateBody(float DeltaTime);
	void CheckBodyTouch();
	void ReleaseHeld(bool bGrantImmunity);
	AHDCharacter* FindScentTarget() const;
};
