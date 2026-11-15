#include "HDWorldActors.h"
#include "HDCharacter.h"
#include "HDSubsystems.h"

#include "Components/BoxComponent.h"
#include "Components/SphereComponent.h"
#include "Components/SplineComponent.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"

AHDPickup::AHDPickup()
{
	Trigger = CreateDefaultSubobject<USphereComponent>(TEXT("Trigger"));
	Trigger->InitSphereRadius(80.f);
	Trigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	RootComponent = Trigger;
}

void AHDPickup::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	if (AHDCharacter* Character = Cast<AHDCharacter>(OtherActor))
	{
		Character->AddItem(ItemId, Count);
		Destroy();
	}
}

AHDHerbalist::AHDHerbalist()
{
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

bool AHDHerbalist::Interact(AHDCharacter* Character)
{
	if (!Character)
	{
		return false;
	}
	const bool bBrewed = Character->RemoveItem(RequiredItem, RequiredCount);
	if (bBrewed)
	{
		Character->AddItem(AHDCharacter::TonicItemId, 1);
	}
	OnInteracted(Character, bBrewed);
	return bBrewed;
}

AHDRealmMarker::AHDRealmMarker()
{
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AHDRealmMarker::BeginPlay()
{
	Super::BeginPlay();
	if (UHDRealmSubsystem* Subsystem = GetWorld()->GetSubsystem<UHDRealmSubsystem>())
	{
		Subsystem->SetRealm(Realm);
	}
}

AHDSinkhole::AHDSinkhole()
{
	Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
	Trigger->InitBoxExtent(FVector(150.f, 150.f, 100.f));
	Trigger->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
	RootComponent = Trigger;
}

void AHDSinkhole::NotifyActorBeginOverlap(AActor* OtherActor)
{
	Super::NotifyActorBeginOverlap(OtherActor);
	AHDCharacter* Character = Cast<AHDCharacter>(OtherActor);
	if (!Character)
	{
		return;
	}
	OnFellThrough(Character);

	if (!DestinationLevel.IsNone())
	{
		UGameplayStatics::OpenLevel(this, DestinationLevel);
	}
	else if (DestinationActor)
	{
		Character->TeleportTo(DestinationActor->GetActorLocation(), DestinationActor->GetActorRotation());
		if (UHDRealmSubsystem* Subsystem = GetWorld()->GetSubsystem<UHDRealmSubsystem>())
		{
			Subsystem->SetRealm(DestinationRealm);
		}
	}
}

AHDSightseeingPath::AHDSightseeingPath()
{
	Spline = CreateDefaultSubobject<USplineComponent>(TEXT("Spline"));
	RootComponent = Spline;
}
