namespace TrainRekt.Api.Domain.Constants;

public static class AiSafetyCoachVersion
{
    // Increment this version whenever coach prompt semantics or output behavior changes,
    // so persisted coach snapshots are invalidated.
    public const int Current = 3;
}