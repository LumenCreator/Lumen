#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HDHeartbeatComponent.generated.h"

class AHDListeningCoil;

UENUM(BlueprintType)
enum class EHDHeartbeatState : uint8
{
	Idle,
	Calming,     // press in time with three beats
	Constricted  // mash to break free
};

/**
 * The heartbeat touch. When the Coil's body brushes the player it presses in to feel
 * their heartbeat: calm three beats and it slides past, fail and it crushes.
 */
UCLASS(ClassGroup = (HollowDeep), meta = (BlueprintSpawnableComponent))
class HOLLOWDEEP_API UHDHeartbeatComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UHDHeartbeatComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Heartbeat")
	float BeatInterval = 0.9f;

	/** Seconds either side of a beat that still count as on time. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Heartbeat")
	float BeatWindow = 0.18f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Heartbeat")
	int32 BeatsToCalm = 3;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Heartbeat")
	int32 MissesAllowed = 1;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Heartbeat")
	float BreakFreePerPress = 0.14f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Heartbeat")
	float BreakFreeDecayPerSecond = 0.2f;

	void Begin(AHDListeningCoil* InCoil);
	void Cancel();

	/** The calm / struggle button. */
	UFUNCTION(BlueprintCallable, Category = "Heartbeat")
	void Press();

	UFUNCTION(BlueprintPure, Category = "Heartbeat")
	EHDHeartbeatState GetState() const { return State; }

	UFUNCTION(BlueprintPure, Category = "Heartbeat")
	bool IsActive() const { return State != EHDHeartbeatState::Idle; }

	UFUNCTION(BlueprintPure, Category = "Heartbeat")
	int32 GetCalmedBeats() const { return CalmedBeats; }

	/** 1 exactly on the beat, falling to 0 between beats. Drive the UI pulse with it. */
	UFUNCTION(BlueprintPure, Category = "Heartbeat")
	float GetBeatPulse() const;

	UFUNCTION(BlueprintPure, Category = "Heartbeat")
	float GetBreakFreeProgress() const { return BreakFree; }

private:
	EHDHeartbeatState State = EHDHeartbeatState::Idle;
	TWeakObjectPtr<AHDListeningCoil> Coil;
	float BeatTime = 0.f;
	int32 NextBeat = 1;
	int32 CalmedBeats = 0;
	int32 Misses = 0;
	float BreakFree = 0.f;

	void Finish(bool bSuccess);
};
