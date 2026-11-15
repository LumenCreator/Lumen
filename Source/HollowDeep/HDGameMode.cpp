#include "HDGameMode.h"
#include "HDCharacter.h"
#include "HDDayCycleDirector.h"
#include "HDHeartbeatComponent.h"
#include "HDListeningCoil.h"
#include "HDStaminaComponent.h"

#include "Engine/Canvas.h"
#include "EngineUtils.h"

AHDGameMode::AHDGameMode()
{
	DefaultPawnClass = AHDCharacter::StaticClass();
	HUDClass = AHDDebugHUD::StaticClass();
}

void AHDDebugHUD::DrawBar(float X, float Y, float Width, float Fraction, const FLinearColor& Color, const FString& Label)
{
	DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.5f), X, Y, Width, 14.f);
	DrawRect(Color, X, Y, Width * FMath::Clamp(Fraction, 0.f, 1.f), 14.f);
	DrawText(Label, FLinearColor::White, X + Width + 10.f, Y - 2.f);
}

void AHDDebugHUD::DrawHUD()
{
	Super::DrawHUD();

	const AHDCharacter* Character = Cast<AHDCharacter>(GetOwningPawn());
	if (!Character || !Canvas || Character->IsSightseeing())
	{
		return;
	}

	float Y = 40.f;
	DrawBar(40.f, Y, 260.f, Character->GetHealth() / FMath::Max(Character->MaxHealth, 1.f), FLinearColor(0.8f, 0.1f, 0.1f), TEXT("Health"));
	Y += 22.f;
	const bool bExhausted = Character->Stamina->IsExhausted();
	DrawBar(40.f, Y, 260.f, Character->Stamina->GetFraction(),
		bExhausted ? FLinearColor(0.9f, 0.5f, 0.1f) : FLinearColor(0.2f, 0.8f, 0.3f),
		bExhausted ? TEXT("Stamina (exhausted)") : TEXT("Stamina"));
	Y += 22.f;

	DrawRect(Character->GetMagicColor(), 40.f, Y, 14.f, 14.f);
	DrawText(FString::Printf(TEXT("Tonics: %d   Sunpetals: %d"),
		Character->GetItemCount(AHDCharacter::TonicItemId), Character->GetItemCount(TEXT("Sunpetal"))),
		FLinearColor::White, 64.f, Y - 2.f);
	Y += 22.f;

	if (Character->IsScentHidden())
	{
		DrawText(FString::Printf(TEXT("Coldblood Tonic: scent hidden for %.0fs"), Character->GetTonicTimeLeft()),
			FLinearColor(0.5f, 0.8f, 1.f), 40.f, Y);
		Y += 22.f;
	}

	for (TActorIterator<AHDDayCycleDirector> It(GetWorld()); It; ++It)
	{
		static const TCHAR* PhaseNames[] = { TEXT("Day"), TEXT("Sunset"), TEXT("Night") };
		DrawText(FString::Printf(TEXT("Day %d  -  %s"), It->GetDaysElapsed() + 1, PhaseNames[(int32)It->GetPhase()]),
			FLinearColor::White, Canvas->ClipX - 220.f, 40.f);
		break;
	}

	const float CenterX = Canvas->ClipX * 0.5f;
	for (TActorIterator<AHDListeningCoil> It(GetWorld()); It; ++It)
	{
		static const TCHAR* StateNames[] = {
			TEXT("RISING - move"), TEXT("LISTENING - be still"), TEXT("LUNGING"),
			TEXT("STUCK - strike the weak point"), TEXT("PRESSING"), TEXT("CONSTRICTING"), TEXT("DEAD") };
		DrawBar(CenterX - 200.f, 40.f, 400.f, It->GetHealth() / FMath::Max(It->MaxHealth, 1.f), FLinearColor(0.6f, 0.1f, 0.5f), TEXT("The Listening Coil"));
		DrawText(StateNames[(int32)It->GetState()], FLinearColor::White, CenterX - 200.f, 60.f);
		if (It->GetState() == EHDCoilState::Listening)
		{
			DrawBar(CenterX - 200.f, 84.f, 400.f, It->GetVibrationFraction(), FLinearColor(1.f, 0.85f, 0.2f), TEXT("Vibration"));
		}
		break;
	}

	const UHDHeartbeatComponent* Heartbeat = Character->Heartbeat;
	const float PromptY = Canvas->ClipY * 0.65f;
	if (Heartbeat->GetState() == EHDHeartbeatState::Calming)
	{
		const float Size = 30.f + 50.f * Heartbeat->GetBeatPulse();
		DrawRect(FLinearColor(0.9f, 0.1f, 0.15f, 0.9f), CenterX - Size * 0.5f, PromptY - Size * 0.5f, Size, Size);
		DrawText(FString::Printf(TEXT("Calm your heartbeat: press E or Space on the beat (%d / %d)"),
			Heartbeat->GetCalmedBeats(), Heartbeat->BeatsToCalm), FLinearColor::White, CenterX - 230.f, PromptY + 60.f);
	}
	else if (Heartbeat->GetState() == EHDHeartbeatState::Constricted)
	{
		DrawBar(CenterX - 150.f, PromptY, 300.f, Heartbeat->GetBreakFreeProgress(), FLinearColor::White, TEXT(""));
		DrawText(TEXT("Crushed! Mash E or Space to break free"), FLinearColor::White, CenterX - 150.f, PromptY + 24.f);
	}
}
