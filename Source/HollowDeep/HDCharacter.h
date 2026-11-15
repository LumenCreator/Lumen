#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "HDTypes.h"
#include "HDCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class UHDStaminaComponent;
class UHDHeartbeatComponent;
class AHDSightseeingPath;
struct FInputActionValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHDOnSightseeingChanged, bool, bSightseeing);

/**
 * Third-person player: walk, sprint with stamina, crouch, strike, stamp, drink the tonic,
 * sightseeing mode. Make a Blueprint child (BP_HDCharacter) to assign the mesh and anim blueprint.
 *
 * Keys (built in code, no input assets needed):
 * WASD move, mouse look, Shift sprint, Ctrl/C crouch, LMB strike, F stamp, Q tonic,
 * E interact / calm heartbeat, Space jump / calm heartbeat, V sightseeing.
 */
UCLASS()
class HOLLOWDEEP_API AHDCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AHDCharacter();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// ---- Components
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UCameraComponent> FollowCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UHDStaminaComponent> Stamina;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UHDHeartbeatComponent> Heartbeat;

	// ---- Movement
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement")
	float WalkSpeed = 400.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement")
	float SprintSpeed = 750.f;

	/** The tired jog you are stuck with while exhausted. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement")
	float ExhaustedSpeed = 280.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Movement")
	float CrouchSpeed = 180.f;

	// ---- Vibration (strength per footfall; the Coil lunges at 1.0)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vibration")
	float SprintStepNoise = 0.30f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vibration")
	float WalkStepNoise = 0.20f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vibration")
	float CrouchStepNoise = 0.015f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vibration")
	float BreathNoise = 0.08f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vibration")
	float StrikeNoise = 0.35f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vibration")
	float StampNoise = 1.0f;

	// ---- Combat
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	float MaxHealth = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	float StrikeDamage = 20.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	float StrikeRange = 220.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	float StrikeRadius = 120.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	float StrikeCooldown = 0.6f;

	/** Exhausted players fight worse. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	float ExhaustedDamageMultiplier = 0.6f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Combat")
	FHDMagicBuild MagicBuild;

	// ---- Coldblood Tonic
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tonic")
	float TonicDuration = 240.f;

	// ---- Sightseeing
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sightseeing")
	float NormalArmLength = 350.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sightseeing")
	float SightseeingArmLength = 1400.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sightseeing")
	float SightseeingSpeed = 220.f;

	/** Fade the HUD out and in on this. */
	UPROPERTY(BlueprintAssignable, Category = "Sightseeing")
	FHDOnSightseeingChanged OnSightseeingChanged;

	// ---- Queries
	UFUNCTION(BlueprintPure, Category = "Hollow Deep")
	float GetHealth() const { return Health; }

	UFUNCTION(BlueprintPure, Category = "Hollow Deep")
	bool IsSprinting() const { return bSprinting; }

	UFUNCTION(BlueprintPure, Category = "Hollow Deep")
	bool IsSightseeing() const { return bSightseeing; }

	/** True while the tonic hides scent and body heat from the Coil. */
	UFUNCTION(BlueprintPure, Category = "Hollow Deep")
	bool IsScentHidden() const { return TonicTimeLeft > 0.f; }

	UFUNCTION(BlueprintPure, Category = "Hollow Deep")
	float GetTonicTimeLeft() const { return TonicTimeLeft; }

	UFUNCTION(BlueprintPure, Category = "Hollow Deep")
	FLinearColor GetMagicColor() const { return MagicBuild.GetBlendedColor(); }

	// ---- Inventory (placeholder until a real inventory exists)
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	void AddItem(FName ItemId, int32 Count = 1);

	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool RemoveItem(FName ItemId, int32 Count = 1);

	UFUNCTION(BlueprintPure, Category = "Inventory")
	int32 GetItemCount(FName ItemId) const;

	// ---- Hooks for animation, sound and Niagara
	UFUNCTION(BlueprintImplementableEvent, Category = "Hollow Deep")
	void OnStrike();

	UFUNCTION(BlueprintImplementableEvent, Category = "Hollow Deep")
	void OnStamp();

	UFUNCTION(BlueprintImplementableEvent, Category = "Hollow Deep")
	void OnTonicDrunk();

	UFUNCTION(BlueprintImplementableEvent, Category = "Hollow Deep")
	void OnDied();

	static const FName TonicItemId;

private:
	UPROPERTY(Transient) TObjectPtr<UInputMappingContext> MappingContext;
	UPROPERTY(Transient) TObjectPtr<UInputAction> MoveAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> LookAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> SprintAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> CrouchAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> JumpAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> StrikeAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> StampAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> TonicAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> InteractAction;
	UPROPERTY(Transient) TObjectPtr<UInputAction> SightseeingAction;

	UPROPERTY() TMap<FName, int32> Inventory;
	UPROPERTY() TObjectPtr<AHDSightseeingPath> SightseeingPath;

	float Health = 100.f;
	float TonicTimeLeft = 0.f;
	float StepTimer = 0.f;
	float BreathTimer = 0.f;
	float LastStrikeTime = -100.f;
	bool bWantsSprint = false;
	bool bSprinting = false;
	bool bSightseeing = false;
	FTransform RespawnTransform;

	void BuildInput();
	bool IsRestrained() const;
	void EmitVibration(float Strength);
	void Die();
	void TickSightseeing(float DeltaTime);

	void InputMove(const FInputActionValue& Value);
	void InputLook(const FInputActionValue& Value);
	void InputSprintStart();
	void InputSprintStop();
	void InputCrouch();
	void InputJump();
	void InputStrike();
	void InputStamp();
	void InputTonic();
	void InputInteract();
	void InputSightseeing();
};
