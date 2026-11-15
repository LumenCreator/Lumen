#include "HDSubsystems.h"

void UHDVibrationSubsystem::ReportVibration(FVector Location, float Strength, AActor* Source)
{
	if (Strength > 0.f)
	{
		OnVibration.Broadcast(Location, Strength, Source);
	}
}

void UHDRealmSubsystem::SetRealm(EHDRealm NewRealm)
{
	if (Realm != NewRealm)
	{
		Realm = NewRealm;
		OnRealmChanged.Broadcast(Realm);
	}
}
