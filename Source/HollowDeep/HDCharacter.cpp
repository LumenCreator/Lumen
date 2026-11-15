#include "HDCharacter.h"
#include "HDStaminaComponent.h"
#include "HDHeartbeatComponent.h"
#include "HDSubsystems.h"
#include "HDWorldActors.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SplineComponent.h"
#include "Engine/DamageEvents.h"
#include "Engine/LocalPlayer.h"
#include "Engine/OverlapResult.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "Kismet/GameplayStatics.h"

const FName AHDCharacter::TonicItemId(TEXT("ColdbloodTonic"));

AHDCharacter::AHDCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->bOrientRotationToMovement = true;
	Move->RotationRate = FRotator(0.f, 540.f, 0.f);
	Move->MaxWalkSpeed = WalkSpeed;
	Move->MaxWalkSpeedCrouched = CrouchSpeed;
	Move->GetNavAgentPropertiesRef().bCanCrouch = true;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = NormalArmLength;
	CameraBoom->SocketOffset = FVector(0.f, 40.f, 60.f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 10.f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	Stamina = CreateDefaultSubobject<UHDStaminaComponent>(TEXT("Stamina"));
	Heartbeat = CreateDefaultSubobject<UHDHeartbeatComponent>(TEXT("Heartbeat"));
}

void AHDCharacter::BeginPlay()
{
	Super::BeginPlay();
	Health = MaxHealth;
	RespawnTransform = GetActorTransform();
	GetCharacterMovement()->MaxWalkSpeedCrouched = CrouchSpeed;
}

// ---------------------------------------------------------------- input

void AHDCharacter::BuildInput()
{
	if (MappingContext)
	{
		return;
	}
	MappingContext = NewObject<UInputMappingContext>(this, TEXT("IMC_HollowDeep"));

	auto MakeAction = [this](const TCHAR* Name, EInputActionValueType Type)
	{
		UInputAction* Action = NewObject<UInputAction>(this, Name);
		Action->ValueType = Type;
		return Action;
	};

	MoveAction = MakeAction(TEXT("IA_Move"), EInputActionValueType::Axis2D);
	LookAction = MakeAction(TEXT("IA_Look"), EInputActionValueType::Axis2D);
	SprintAction = MakeAction(TEXT("IA_Sprint"), EInputActionValueType::Boolean);
	CrouchAction = MakeAction(TEXT("IA_Crouch"), EInputActionValueType::Boolean);
	JumpAction = MakeAction(TEXT("IA_Jump"), EInputActionValueType::Boolean);
	StrikeAction = MakeAction(TEXT("IA_Strike"), EInputActionValueType::Boolean);
	StampAction = MakeAction(TEXT("IA_Stamp"), EInputActionValueType::Boolean);
	TonicAction = MakeAction(TEXT("IA_Tonic"), EInputActionValueType::Boolean);
	InteractAction = MakeAction(TEXT("IA_Interact"), EInputActionValueType::Boolean);
	SightseeingAction = MakeAction(TEXT("IA_Sightseeing"), EInputActionValueType::Boolean);

	// A key press arrives on X. Swizzle moves it to Y (forward), Negate flips it.
	auto MapMove = [this](FKey Key, bool bNegate, bool bSwizzle)
	{
		FEnhancedActionKeyMapping& Mapping = MappingContext->MapKey(MoveAction, Key);
		if (bNegate)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(MappingContext));
		}
		if (bSwizzle)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(MappingContext));
		}
	};
	MapMove(EKeys::W, false, true);
	MapMove(EKeys::S, true, true);
	MapMove(EKeys::D, false, false);
	MapMove(EKeys::A, true, false);

	MappingContext->MapKey(LookAction, EKeys::Mouse2D);
	MappingContext->MapKey(SprintAction, EKeys::LeftShift);
	MappingContext->MapKey(CrouchAction, EKeys::LeftControl);
	MappingContext->MapKey(CrouchAction, EKeys::C);
	MappingContext->MapKey(JumpAction, EKeys::SpaceBar);
	MappingContext->MapKey(StrikeAction, EKeys::LeftMouseButton);
	MappingContext->MapKey(StampAction, EKeys::F);
	MappingContext->MapKey(TonicAction, EKeys::Q);
	MappingContext->MapKey(InteractAction, EKeys::E);
	MappingContext->MapKey(SightseeingAction, EKeys::V);
}

void AHDCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	BuildInput();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (const ULocalPlayer* LocalPlayer = PC->GetLocalPlayer())
		{
			if (UEnhancedInputLocalPlayerSubsystem* Subsystem = LocalPlayer->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
			{
				Subsystem->AddMappingContext(MappingContext, 0);
			}
		}
	}

	if (UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AHDCharacter::InputMove);
		Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &AHDCharacter::InputLook);
		Input->BindAction(SprintAction, ETriggerEvent::Started, this, &AHDCharacter::InputSprintStart);
		Input->BindAction(SprintAction, ETriggerEvent::Completed, this, &AHDCharacter::InputSprintStop);
		Input->BindAction(CrouchAction, ETriggerEvent::Started, this, &AHDCharacter::InputCrouch);
		Input->BindAction(JumpAction, ETriggerEvent::Started, this, &AHDCharacter::InputJump);
		Input->BindAction(StrikeAction, ETriggerEvent::Started, this, &AHDCharacter::InputStrike);
		Input->BindAction(StampAction, ETriggerEvent::Started, this, &AHDCharacter::InputStamp);
		Input->BindAction(TonicAction, ETriggerEvent::Started, this, &AHDCharacter::InputTonic);
		Input->BindAction(InteractAction, ETriggerEvent::Started, this, &AHDCharacter::InputInteract);
		Input->BindAction(SightseeingAction, ETriggerEvent::Started, this, &AHDCharacter::InputSightseeing);
	}
}

bool AHDCharacter::IsRestrained() const
{
	return Heartbeat->IsActive();
}

void AHDCharacter::InputMove(const FInputActionValue& Value)
{
	if (bSightseeing || IsRestrained())
	{
		return;
	}
	const FVector2D Axis = Value.Get<FVector2D>();
	const FRotationMatrix YawMatrix(FRotator(0.f, GetControlRotation().Yaw, 0.f));
	AddMovementInput(YawMatrix.GetUnitAxis(EAxis::X), Axis.Y);
	AddMovementInput(YawMatrix.GetUnitAxis(EAxis::Y), Axis.X);
}

void AHDCharacter::InputLook(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	AddControllerYawInput(Axis.X);
	AddControllerPitchInput(-Axis.Y);
}

void AHDCharacter::InputSprintStart() { bWantsSprint = true; }
void AHDCharacter::InputSprintStop() { bWantsSprint = false; }

void AHDCharacter::InputCrouch()
{
	if (bSightseeing || IsRestrained())
	{
		return;
	}
	if (bIsCrouched)
	{
		UnCrouch();
	}
	else
	{
		Crouch();
	}
}

void AHDCharacter::InputJump()
{
	if (IsRestrained())
	{
		Heartbeat->Press();
	}
	else if (!bSightseeing)
	{
		Jump();
	}
}

void AHDCharacter::InputStrike()
{
	UWorld* World = GetWorld();
	if (bSightseeing || IsRestrained() || World->GetTimeSeconds() - LastStrikeTime < StrikeCooldown)
	{
		return;
	}
	LastStrikeTime = World->GetTimeSeconds();
	EmitVibration(StrikeNoise);
	OnStrike();

	float Damage = StrikeDamage;
	if (Stamina->IsExhausted())
	{
		Damage *= ExhaustedDamageMultiplier;
	}
	// Holy magic deals half damage in the Underside, scaled by how Holy the build is.
	if (const UHDRealmSubsystem* Realm = World->GetSubsystem<UHDRealmSubsystem>())
	{
		if (Realm->GetRealm() == EHDRealm::Underside)
		{
			Damage *= 1.f - 0.5f * MagicBuild.HolyFraction();
		}
	}

	const FVector Center = GetActorLocation() + GetActorForwardVector() * StrikeRange * 0.6f;
	FCollisionObjectQueryParams ObjectTypes;
	ObjectTypes.AddObjectTypesToQuery(ECC_Pawn);
	ObjectTypes.AddObjectTypesToQuery(ECC_WorldDynamic);
	FCollisionQueryParams Params(SCENE_QUERY_STAT(HDStrike), false, this);

	TArray<FOverlapResult> Overlaps;
	World->OverlapMultiByObjectType(Overlaps, Center, FQuat::Identity, ObjectTypes,
		FCollisionShape::MakeSphere(StrikeRadius), Params);

	TSet<AActor*> Hit;
	for (const FOverlapResult& Overlap : Overlaps)
	{
		AActor* Other = Overlap.GetActor();
		if (Other && !Hit.Contains(Other))
		{
			Hit.Add(Other);
			UGameplayStatics::ApplyDamage(Other, Damage, GetController(), this, nullptr);
		}
	}
}

void AHDCharacter::InputStamp()
{
	if (bSightseeing || IsRestrained() || !GetCharacterMovement()->IsMovingOnGround())
	{
		return;
	}
	EmitVibration(StampNoise);
	OnStamp();
}

void AHDCharacter::InputTonic()
{
	if (!IsRestrained() && RemoveItem(TonicItemId, 1))
	{
		TonicTimeLeft = TonicDuration;
		OnTonicDrunk();
	}
}

void AHDCharacter::InputInteract()
{
	if (IsRestrained())
	{
		Heartbeat->Press();
		return;
	}
	for (TActorIterator<AHDHerbalist> It(GetWorld()); It; ++It)
	{
		if (FVector::Dist(It->GetActorLocation(), GetActorLocation()) <= It->InteractRange)
		{
			It->Interact(this);
			return;
		}
	}
}

void AHDCharacter::InputSightseeing()
{
	if (IsRestrained())
	{
		return;
	}
	if (!bSightseeing)
	{
		SightseeingPath = Cast<AHDSightseeingPath>(UGameplayStatics::GetActorOfClass(this, AHDSightseeingPath::StaticClass()));
		if (!SightseeingPath)
		{
			return; // no footpath spline placed in this level
		}
		UnCrouch();
	}
	bSightseeing = !bSightseeing;
	OnSightseeingChanged.Broadcast(bSightseeing);
}

// ---------------------------------------------------------------- tick

void AHDCharacter::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	UCharacterMovementComponent* Move = GetCharacterMovement();
	const float Speed2D = GetVelocity().Size2D();
	const bool bGrounded = Move->IsMovingOnGround();
	const bool bExhausted = Stamina->IsExhausted();

	bSprinting = bWantsSprint && !bSightseeing && !IsRestrained() && !bIsCrouched
		&& bGrounded && Speed2D > 10.f && Stamina->CanSprint();
	Stamina->SetDraining(bSprinting);

	if (bSightseeing)
	{
		Move->MaxWalkSpeed = SightseeingSpeed;
		TickSightseeing(DeltaTime);
	}
	else
	{
		Move->MaxWalkSpeed = bSprinting ? SprintSpeed : (bExhausted ? ExhaustedSpeed : WalkSpeed);
	}

	const float TargetArm = bSightseeing ? SightseeingArmLength : NormalArmLength;
	CameraBoom->TargetArmLength = FMath::FInterpTo(CameraBoom->TargetArmLength, TargetArm, DeltaTime, 1.5f);

	// Footfalls: one vibration pulse per stride. Louder and faster when sprinting.
	if (bGrounded && Speed2D > 20.f)
	{
		StepTimer -= DeltaTime;
		if (StepTimer <= 0.f)
		{
			if (bIsCrouched)
			{
				EmitVibration(CrouchStepNoise);
				StepTimer = 0.7f;
			}
			else if (bSprinting)
			{
				EmitVibration(SprintStepNoise);
				StepTimer = 0.3f;
			}
			else
			{
				EmitVibration(WalkStepNoise);
				StepTimer = 0.45f;
			}
		}
	}
	else
	{
		StepTimer = 0.f;
	}

	// Being out of breath is noisy even when standing still.
	if (bExhausted)
	{
		BreathTimer -= DeltaTime;
		if (BreathTimer <= 0.f)
		{
			EmitVibration(BreathNoise);
			BreathTimer = 1.2f;
		}
	}

	TonicTimeLeft = FMath::Max(0.f, TonicTimeLeft - DeltaTime);
}

void AHDCharacter::TickSightseeing(float DeltaTime)
{
	if (!SightseeingPath)
	{
		bSightseeing = false;
		OnSightseeingChanged.Broadcast(false);
		return;
	}
	const USplineComponent* Spline = SightseeingPath->Spline;
	const float Key = Spline->FindInputKeyClosestToWorldLocation(GetActorLocation());
	const float Length = Spline->GetSplineLength();
	float Ahead = Spline->GetDistanceAlongSplineAtSplineInputKey(Key) + 300.f;
	if (Spline->IsClosedLoop())
	{
		Ahead = FMath::Fmod(Ahead, Length);
	}
	else if (Ahead >= Length)
	{
		InputSightseeing(); // reached the end of the path
		return;
	}
	const FVector Target = Spline->GetLocationAtDistanceAlongSpline(Ahead, ESplineCoordinateSpace::World);
	AddMovementInput((Target - GetActorLocation()).GetSafeNormal2D());
}

// ---------------------------------------------------------------- helpers

void AHDCharacter::EmitVibration(float Strength)
{
	if (UHDVibrationSubsystem* Vibration = GetWorld()->GetSubsystem<UHDVibrationSubsystem>())
	{
		const FVector Feet = GetActorLocation() - FVector(0.f, 0.f, GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
		Vibration->ReportVibration(Feet, Strength, this);
	}
}

float AHDCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	if (Applied > 0.f && Health > 0.f)
	{
		Health -= Applied;
		if (Health <= 0.f)
		{
			Die();
		}
	}
	return Applied;
}

void AHDCharacter::Die()
{
	OnDied();
	Heartbeat->Cancel();

	// Prototype rule: you drop your tonics where you fell and have to go back for them.
	// The full rule (drop everything except 10 chosen items) comes with the real inventory.
	const int32 Tonics = GetItemCount(TonicItemId);
	if (Tonics > 0)
	{
		RemoveItem(TonicItemId, Tonics);
		if (AHDPickup* Drop = GetWorld()->SpawnActor<AHDPickup>(AHDPickup::StaticClass(), GetActorLocation(), FRotator::ZeroRotator))
		{
			Drop->ItemId = TonicItemId;
			Drop->Count = Tonics;
		}
	}

	TonicTimeLeft = 0.f;
	bSightseeing = false;
	Health = MaxHealth;
	Stamina->Restore(Stamina->GetMaxStamina());
	TeleportTo(RespawnTransform.GetLocation(), RespawnTransform.Rotator(), false, true);
}

void AHDCharacter::AddItem(FName ItemId, int32 Count)
{
	if (Count > 0)
	{
		Inventory.FindOrAdd(ItemId) += Count;
	}
}

bool AHDCharacter::RemoveItem(FName ItemId, int32 Count)
{
	int32* Have = Inventory.Find(ItemId);
	if (!Have || *Have < Count)
	{
		return false;
	}
	*Have -= Count;
	return true;
}

int32 AHDCharacter::GetItemCount(FName ItemId) const
{
	const int32* Have = Inventory.Find(ItemId);
	return Have ? *Have : 0;
}
