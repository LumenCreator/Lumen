#include "HDStaminaComponent.h"

UHDStaminaComponent::UHDStaminaComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UHDStaminaComponent::BeginPlay()
{
	Super::BeginPlay();
	Stamina = GetMaxStamina();
}

void UHDStaminaComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (bDraining)
	{
		TimeSinceDrain = 0.f;
		Stamina = FMath::Max(0.f, Stamina - SprintDrainPerSecond * GearWeightMultiplier * DeltaTime);
		if (Stamina <= 0.f)
		{
			SetExhausted(true);
		}
	}
	else
	{
		TimeSinceDrain += DeltaTime;
		if (TimeSinceDrain >= RegenDelay)
		{
			Restore(RegenPerSecond * DeltaTime);
		}
	}
}

void UHDStaminaComponent::Restore(float Amount)
{
	Stamina = FMath::Min(GetMaxStamina(), Stamina + Amount);
	if (bExhausted && GetFraction() >= RecoverFraction)
	{
		SetExhausted(false);
	}
}

void UHDStaminaComponent::SetExhausted(bool bNew)
{
	if (bExhausted != bNew)
	{
		bExhausted = bNew;
		OnExhaustedChanged.Broadcast(bExhausted);
	}
}
