#include "HDHeartbeatComponent.h"
#include "HDCharacter.h"
#include "HDListeningCoil.h"

UHDHeartbeatComponent::UHDHeartbeatComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UHDHeartbeatComponent::Begin(AHDListeningCoil* InCoil)
{
	Coil = InCoil;
	State = EHDHeartbeatState::Calming;
	BeatTime = 0.f;
	NextBeat = 1;
	CalmedBeats = 0;
	Misses = 0;
	BreakFree = 0.f;
}

void UHDHeartbeatComponent::Cancel()
{
	State = EHDHeartbeatState::Idle;
	Coil.Reset();
}

float UHDHeartbeatComponent::GetBeatPulse() const
{
	if (State != EHDHeartbeatState::Calming)
	{
		return 0.f;
	}
	const float Phase = FMath::Fmod(BeatTime, BeatInterval);
	const float ToBeat = FMath::Min(Phase, BeatInterval - Phase);
	return 1.f - FMath::Clamp(ToBeat / (BeatInterval * 0.5f), 0.f, 1.f);
}

void UHDHeartbeatComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (State == EHDHeartbeatState::Calming)
	{
		BeatTime += DeltaTime;
		if (BeatTime > NextBeat * BeatInterval + BeatWindow)
		{
			// Let a beat go by without calming it.
			++NextBeat;
			if (++Misses > MissesAllowed)
			{
				Finish(false);
			}
		}
	}
	else if (State == EHDHeartbeatState::Constricted)
	{
		BreakFree = FMath::Max(0.f, BreakFree - BreakFreeDecayPerSecond * DeltaTime);
	}
}

void UHDHeartbeatComponent::Press()
{
	if (State == EHDHeartbeatState::Calming)
	{
		if (BeatTime < 0.4f)
		{
			return; // ignore a button that was already going down when it touched you
		}
		const float Offset = FMath::Abs(BeatTime - NextBeat * BeatInterval);
		if (Offset <= BeatWindow)
		{
			++NextBeat;
			if (++CalmedBeats >= BeatsToCalm)
			{
				Finish(true);
			}
		}
		else
		{
			Finish(false); // panicked off the beat
		}
	}
	else if (State == EHDHeartbeatState::Constricted)
	{
		BreakFree += BreakFreePerPress;
		if (BreakFree >= 1.f)
		{
			AHDListeningCoil* C = Coil.Get();
			Cancel();
			if (C)
			{
				C->NotifyBrokeFree(Cast<AHDCharacter>(GetOwner()));
			}
		}
	}
}

void UHDHeartbeatComponent::Finish(bool bSuccess)
{
	AHDListeningCoil* C = Coil.Get();
	if (bSuccess || !C)
	{
		Cancel();
	}
	else
	{
		State = EHDHeartbeatState::Constricted;
		BreakFree = 0.f;
	}
	if (C)
	{
		C->NotifyHeartbeatResult(Cast<AHDCharacter>(GetOwner()), bSuccess);
	}
}
