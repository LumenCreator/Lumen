#include "HDListeningCoil.h"
#include "HDCharacter.h"
#include "HDHeartbeatComponent.h"
#include "HDSubsystems.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SphereComponent.h"
#include "Engine/DamageEvents.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

AHDListeningCoil::AHDListeningCoil()
{
	PrimaryActorTick.bCanEverTick = true;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

	Head = CreateDefaultSubobject<USphereComponent>(TEXT("Head"));
	Head->SetupAttachment(RootComponent);
	Head->InitSphereRadius(160.f);
	Head->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	Head->SetHiddenInGame(false); // visible wire sphere until the real head mesh exists

	WeakPointGlow = CreateDefaultSubobject<UPointLightComponent>(TEXT("WeakPointGlow"));
	WeakPointGlow->SetupAttachment(Head);
	WeakPointGlow->SetRelativeLocation(FVector(0.f, 0.f, 180.f));
	WeakPointGlow->SetIntensity(60000.f);
	WeakPointGlow->SetLightColor(FLinearColor(1.f, 0.25f, 0.1f));
	WeakPointGlow->SetVisibility(false);

	BodySegments = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("BodySegments"));
	BodySegments->SetupAttachment(RootComponent);
	BodySegments->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereMesh.Succeeded())
	{
		BodySegments->SetStaticMesh(SphereMesh.Object);
	}
}

void AHDListeningCoil::BeginPlay()
{
	Super::BeginPlay();
	Health = MaxHealth;
	Origin = GetActorLocation();
	WanderGoal = Origin;

	// Lay the body out in a line behind the head.
	const FVector Back = -GetActorForwardVector();
	Segments.Reset();
	BodySegments->ClearInstances();
	for (int32 i = 0; i < SegmentCount; ++i)
	{
		Segments.Add(Origin + Back * SegmentSpacing * (i + 1));
		BodySegments->AddInstance(FTransform::Identity);
	}

	if (UHDVibrationSubsystem* Vibration = GetWorld()->GetSubsystem<UHDVibrationSubsystem>())
	{
		Vibration->OnVibration.AddDynamic(this, &AHDListeningCoil::HandleVibration);
	}
	SetState(EHDCoilState::Rising);
}

void AHDListeningCoil::SetState(EHDCoilState NewState)
{
	State = NewState;
	StateTime = 0.f;
	Meter = 0.f;
	WeakPointGlow->SetVisibility(State == EHDCoilState::Stuck);
	OnStateChanged.Broadcast(State);
}

void AHDListeningCoil::HandleVibration(FVector Location, float Strength, AActor* Source)
{
	if (State != EHDCoilState::Listening || Source == this)
	{
		return;
	}
	const float Distance = FVector::Dist2D(Location, GetActorLocation());
	const float Falloff = FMath::GetMappedRangeValueClamped(
		FVector2D(FullHearingRange, FarHearingRange), FVector2D(1.f, 0.3f), Distance);
	Meter += Strength * Falloff;
	LastVibrationLocation = Location;
}

// ---------------------------------------------------------------- tick

void AHDListeningCoil::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	StateTime += DeltaTime;

	float HeadHeight = HeadRaisedHeight;

	switch (State)
	{
	case EHDCoilState::Rising:
		// Sway while raised.
		HeadHeight = HeadRaisedHeight + FMath::Sin(StateTime * 1.5f) * 60.f;
		TickRising(DeltaTime);
		if (State == EHDCoilState::Rising)
		{
			CheckBodyTouch();
		}
		if (State == EHDCoilState::Rising && StateTime >= RisingDuration)
		{
			SetState(EHDCoilState::Listening);
		}
		break;

	case EHDCoilState::Listening:
	{
		HeadHeight = 0.f;
		Meter = FMath::Max(0.f, Meter - MeterDecayPerSecond * DeltaTime);
		const float Duration = ListenDuration * (IsPhaseTwo() ? Phase2ListenMultiplier : 1.f);
		if (Meter >= VibrationThreshold)
		{
			LungeTarget = FVector(LastVibrationLocation.X, LastVibrationLocation.Y, Origin.Z);
			SetState(EHDCoilState::Lunging);
		}
		else if (StateTime >= Duration)
		{
			SetState(EHDCoilState::Rising);
		}
		break;
	}

	case EHDCoilState::Lunging:
		HeadHeight = 100.f;
		TickLunging(DeltaTime);
		break;

	case EHDCoilState::Stuck:
		HeadHeight = -60.f;
		if (StateTime >= StuckDuration)
		{
			SetState(EHDCoilState::Rising);
		}
		break;

	case EHDCoilState::Pressing:
	case EHDCoilState::Constricting:
	{
		HeadHeight = HeadRaisedHeight * 0.5f;
		AHDCharacter* Held = HeldCharacter.Get();
		if (!Held || !Held->Heartbeat->IsActive())
		{
			ReleaseHeld(true); // they died or the minigame was cancelled
		}
		else if (State == EHDCoilState::Constricting)
		{
			UGameplayStatics::ApplyDamage(Held, CrushDamagePerSecond * DeltaTime, nullptr, this, nullptr);
		}
		break;
	}

	case EHDCoilState::Dead:
		// Sink through the floor.
		AddActorWorldOffset(FVector(0.f, 0.f, -250.f * DeltaTime));
		for (FVector& Segment : Segments)
		{
			Segment.Z -= 250.f * DeltaTime;
		}
		HeadHeight = 0.f;
		break;
	}

	const FVector HeadRelative = Head->GetRelativeLocation();
	Head->SetRelativeLocation(FVector(0.f, 0.f, FMath::FInterpTo(HeadRelative.Z, HeadHeight, DeltaTime, 6.f)));
	UpdateBody(DeltaTime);
}

void AHDListeningCoil::TickRising(float DeltaTime)
{
	const float Speed = MoveSpeed * (IsPhaseTwo() ? Phase2SpeedMultiplier : 1.f);

	// Without the Coldblood Tonic it follows your scent. With it, it just wanders.
	if (const AHDCharacter* Target = FindScentTarget())
	{
		MoveHeadToward(Target->GetActorLocation(), Speed, DeltaTime, 350.f);
		return;
	}

	WanderTimer -= DeltaTime;
	if (WanderTimer <= 0.f || FVector::Dist2D(GetActorLocation(), WanderGoal) < 100.f)
	{
		WanderTimer = 4.f;
		const FVector2D Offset = FMath::RandPointInCircle(ArenaRadius);
		WanderGoal = Origin + FVector(Offset.X, Offset.Y, 0.f);
	}
	MoveHeadToward(WanderGoal, Speed * 0.7f, DeltaTime, 50.f);
}

void AHDListeningCoil::TickLunging(float DeltaTime)
{
	MoveHeadToward(LungeTarget, LungeSpeed, DeltaTime, 0.f);
	if (FVector::Dist2D(GetActorLocation(), LungeTarget) > 30.f)
	{
		return;
	}

	for (TActorIterator<AHDCharacter> It(GetWorld()); It; ++It)
	{
		if (FVector::Dist2D(It->GetActorLocation(), LungeTarget) <= LungeRadius)
		{
			UGameplayStatics::ApplyDamage(*It, LungeDamage, nullptr, this, nullptr);
		}
	}
	OnLungeImpact(LungeTarget);
	SetState(EHDCoilState::Stuck);
}

void AHDListeningCoil::MoveHeadToward(const FVector& Goal, float Speed, float DeltaTime, float StopDistance)
{
	FVector ToGoal = Goal - GetActorLocation();
	ToGoal.Z = 0.f;
	const float Distance = ToGoal.Size();
	if (Distance <= StopDistance || Distance < KINDA_SMALL_NUMBER)
	{
		return;
	}
	const FVector Direction = ToGoal / Distance;
	const float Step = FMath::Min(Speed * DeltaTime, Distance - StopDistance);
	SetActorLocation(GetActorLocation() + Direction * Step);
	SetActorRotation(FMath::RInterpTo(GetActorRotation(), Direction.Rotation(), DeltaTime, 8.f));
}

void AHDListeningCoil::UpdateBody(float DeltaTime)
{
	// Follow the leader: each segment is dragged along at a fixed distance behind the one in front.
	FVector Previous = GetActorLocation();
	const float Scale = BodyRadius * 2.f / 100.f; // the engine sphere is 100 units across
	for (int32 i = 0; i < Segments.Num(); ++i)
	{
		FVector Offset = Segments[i] - Previous;
		if (State != EHDCoilState::Dead)
		{
			Offset.Z = 0.f;
		}
		Segments[i] = Previous + Offset.GetSafeNormal(KINDA_SMALL_NUMBER, FVector::BackwardVector) * SegmentSpacing;
		Previous = Segments[i];

		// Taper towards the tail.
		const float Taper = FMath::Lerp(1.f, 0.35f, (float)i / FMath::Max(Segments.Num() - 1, 1));
		const FTransform Transform(FRotator::ZeroRotator, Segments[i] + FVector(0.f, 0.f, BodyRadius * Taper), FVector(Scale * Taper));
		BodySegments->UpdateInstanceTransform(i, Transform, true, i == Segments.Num() - 1, false);
	}
}

// ---------------------------------------------------------------- touch and heartbeat

void AHDListeningCoil::CheckBodyTouch()
{
	const float Now = GetWorld()->GetTimeSeconds();
	for (TActorIterator<AHDCharacter> It(GetWorld()); It; ++It)
	{
		AHDCharacter* Character = *It;
		if (Character->Heartbeat->IsActive())
		{
			continue;
		}
		if (const float* Until = TouchImmuneUntil.Find(Character))
		{
			if (Now < *Until)
			{
				continue;
			}
		}
		// Skip the neck so it is the body, not the head, that brushes you.
		for (int32 i = 2; i < Segments.Num(); ++i)
		{
			if (FVector::Dist2D(Segments[i], Character->GetActorLocation()) < BodyRadius + 60.f
				&& FMath::Abs(Segments[i].Z - Character->GetActorLocation().Z) < 400.f)
			{
				HeldCharacter = Character;
				Character->Heartbeat->Begin(this);
				SetState(EHDCoilState::Pressing);
				return;
			}
		}
	}
}

void AHDListeningCoil::NotifyHeartbeatResult(AHDCharacter* Character, bool bSuccess)
{
	if (Character != HeldCharacter.Get() || State != EHDCoilState::Pressing)
	{
		return;
	}
	if (bSuccess)
	{
		ReleaseHeld(true); // it slides past
	}
	else
	{
		SetState(EHDCoilState::Constricting);
	}
}

void AHDListeningCoil::NotifyBrokeFree(AHDCharacter* Character)
{
	if (Character == HeldCharacter.Get())
	{
		ReleaseHeld(true);
	}
}

void AHDListeningCoil::ReleaseHeld(bool bGrantImmunity)
{
	if (AHDCharacter* Held = HeldCharacter.Get())
	{
		Held->Heartbeat->Cancel();
		if (bGrantImmunity)
		{
			TouchImmuneUntil.Add(Held, GetWorld()->GetTimeSeconds() + TouchImmunitySeconds);
		}
	}
	HeldCharacter.Reset();
	if (State != EHDCoilState::Dead)
	{
		SetState(EHDCoilState::Rising);
	}
}

AHDCharacter* AHDListeningCoil::FindScentTarget() const
{
	AHDCharacter* Best = nullptr;
	float BestDistance = TNumericLimits<float>::Max();
	for (TActorIterator<AHDCharacter> It(GetWorld()); It; ++It)
	{
		if (It->IsScentHidden())
		{
			continue;
		}
		const float Distance = FVector::Dist2D(It->GetActorLocation(), GetActorLocation());
		if (Distance < BestDistance)
		{
			BestDistance = Distance;
			Best = *It;
		}
	}
	return Best;
}

// ---------------------------------------------------------------- damage

float AHDListeningCoil::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	// The weak point is only exposed while the head is buried.
	if (State != EHDCoilState::Stuck || DamageAmount <= 0.f)
	{
		return 0.f;
	}
	Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	Health = FMath::Max(0.f, Health - DamageAmount);
	if (Health <= 0.f)
	{
		ReleaseHeld(false);
		SetState(EHDCoilState::Dead);
		Head->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		OnDefeated.Broadcast();
		SetLifeSpan(8.f);
	}
	return DamageAmount;
}
