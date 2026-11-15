#include "HDDayCycleDirector.h"
#include "Engine/DirectionalLight.h"

AHDDayCycleDirector::AHDDayCycleDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AHDDayCycleDirector::BeginPlay()
{
	Super::BeginPlay();
	ElapsedSeconds = StartHour * 3600.0;
	LastPhase = GetPhase();
	ApplySun();
}

void AHDDayCycleDirector::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	ElapsedSeconds += DeltaTime * TimeScale;
	ApplySun();

	const EHDDayPhase Phase = GetPhase();
	if (Phase != LastPhase)
	{
		LastPhase = Phase;
		OnPhaseChanged.Broadcast(Phase);
	}
}

float AHDDayCycleDirector::GetHourOfCycle() const
{
	return static_cast<float>(FMath::Fmod(ElapsedSeconds / 3600.0, static_cast<double>(GetCycleHours())));
}

EHDDayPhase AHDDayCycleDirector::GetPhase() const
{
	const float Hour = GetHourOfCycle();
	if (Hour < DayHours)
	{
		return EHDDayPhase::Day;
	}
	return Hour < DayHours + SunsetHours ? EHDDayPhase::Sunset : EHDDayPhase::Night;
}

int32 AHDDayCycleDirector::GetDaysElapsed() const
{
	return FMath::FloorToInt32((ElapsedSeconds - StartHour * 3600.0) / (GetCycleHours() * 3600.0));
}

void AHDDayCycleDirector::SkipHours(float Hours)
{
	ElapsedSeconds += FMath::Max(0.f, Hours) * 3600.0;
}

void AHDDayCycleDirector::ApplySun()
{
	// Sun arc in degrees: 0 = rising on the horizon, 90 = overhead, 180 = set.
	// Day sweeps most of the sky, sunset lingers low, night carries it round underneath.
	const float Hour = GetHourOfCycle();
	float Arc;
	if (Hour < DayHours)
	{
		Arc = FMath::Lerp(0.f, 155.f, Hour / DayHours);
	}
	else if (Hour < DayHours + SunsetHours)
	{
		Arc = FMath::Lerp(155.f, 185.f, (Hour - DayHours) / SunsetHours);
	}
	else
	{
		Arc = FMath::Lerp(185.f, 360.f, (Hour - DayHours - SunsetHours) / NightHours);
	}

	if (Sun)
	{
		Sun->SetActorRotation(FRotator(-Arc, SunYaw, 0.f));
	}
	if (Moon)
	{
		Moon->SetActorRotation(FRotator(-(Arc + 180.f), SunYaw + 20.f, 0.f));
	}
}
