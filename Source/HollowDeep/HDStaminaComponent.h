#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HDStaminaComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHDOnExhaustedChanged, bool, bExhausted);

/** Sprint drains it. At zero you are exhausted until it recovers part of the way. */
UCLASS(ClassGroup = (HollowDeep), meta = (BlueprintSpawnableComponent))
class HOLLOWDEEP_API UHDStaminaComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UHDStaminaComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float BaseMaxStamina = 100.f;

	/** Each endurance point adds this much max stamina. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float StaminaPerEndurance = 2.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	int32 Endurance = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float SprintDrainPerSecond = 18.f;

	/** 1 = no gear. Heavy gear raises this and drains stamina faster. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float GearWeightMultiplier = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float RegenPerSecond = 12.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina")
	float RegenDelay = 1.f;

	/** Exhaustion ends once stamina is back above this fraction of max. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Stamina", meta = (ClampMin = "0", ClampMax = "1"))
	float RecoverFraction = 0.3f;

	UPROPERTY(BlueprintAssignable, Category = "Stamina")
	FHDOnExhaustedChanged OnExhaustedChanged;

	UFUNCTION(BlueprintPure, Category = "Stamina")
	float GetMaxStamina() const { return BaseMaxStamina + StaminaPerEndurance * Endurance; }

	UFUNCTION(BlueprintPure, Category = "Stamina")
	float GetStamina() const { return Stamina; }

	UFUNCTION(BlueprintPure, Category = "Stamina")
	float GetFraction() const { return Stamina / FMath::Max(GetMaxStamina(), 1.f); }

	UFUNCTION(BlueprintPure, Category = "Stamina")
	bool IsExhausted() const { return bExhausted; }

	UFUNCTION(BlueprintPure, Category = "Stamina")
	bool CanSprint() const { return !bExhausted && Stamina > 0.f; }

	/** Resting, food and campfires call this. */
	UFUNCTION(BlueprintCallable, Category = "Stamina")
	void Restore(float Amount);

	void SetDraining(bool bInDraining) { bDraining = bInDraining; }

private:
	float Stamina = 100.f;
	float TimeSinceDrain = 0.f;
	bool bDraining = false;
	bool bExhausted = false;

	void SetExhausted(bool bNew);
};
