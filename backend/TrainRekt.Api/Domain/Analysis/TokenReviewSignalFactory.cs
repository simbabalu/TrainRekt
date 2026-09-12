using System.Globalization;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Domain.Analysis;

public static class TokenReviewSignalFactory
{
    public static IReadOnlyList<TokenReviewSignal> Create(TokenInspection inspection)
    {
        var signals = new List<TokenReviewSignal>();

        var issuanceClaim = inspection.ProtocolContext?.Claims.FirstOrDefault(static claim =>
            string.Equals(claim.Id, "DOCUMENTED_INFLATIONARY_ISSUANCE", StringComparison.Ordinal));

        var hasDocumentedIssuanceContext = issuanceClaim is not null;

        if (!inspection.Authorities.MintAuthorityRevoked)
        {
            var explanation = "An active mint authority can increase token supply.";
            var category = "review";
            var severity = "medium";

            if (hasDocumentedIssuanceContext && issuanceClaim is not null)
            {
                explanation = "An active mint authority can increase token supply. The current active authority is consistent with documented ongoing inflationary issuance, but the authority/control mechanism has not been independently verified.";
                category = "informational";
                severity = "info";
            }

            signals.Add(new TokenReviewSignal(
                Id: "ACTIVE_MINT_AUTHORITY",
                Category: category,
                Severity: severity,
                Explanation: explanation,
                Evidence: new Dictionary<string, string>
                {
                    ["mintAuthority"] = inspection.Authorities.MintAuthority ?? "unknown"
                }));
        }

        if (hasDocumentedIssuanceContext && issuanceClaim is not null)
        {
            var evidence = new Dictionary<string, string>
            {
                ["verificationStatus"] = issuanceClaim.VerificationStatus.ToString(),
                ["verificationMethod"] = issuanceClaim.VerificationMethod.ToString(),
                ["consistency"] = issuanceClaim.Consistency.ToString(),
                ["sourceIds"] = string.Join(",", issuanceClaim.SourceIds)
            };

            if (!string.IsNullOrWhiteSpace(issuanceClaim.VerificationNote))
            {
                evidence["verificationNote"] = issuanceClaim.VerificationNote;
            }

            signals.Add(new TokenReviewSignal(
                Id: "DOCUMENTED_INFLATIONARY_ISSUANCE",
                Category: "informational",
                Severity: "info",
                Explanation: issuanceClaim.Consistency switch
                {
                    ObservedConsistency.Consistent => "Ongoing inflationary issuance is documented, and the observed active mint authority is consistent with that model. The authority/control mechanism has not been independently verified.",
                    ObservedConsistency.Conflict => "Ongoing inflationary issuance is documented, but the observed authority state conflicts with that model. The documentation is not thereby disproven, and the issuance mechanism remains not verified.",
                    _ => issuanceClaim.Statement
                },
                Evidence: evidence));

            if (issuanceClaim.Consistency == ObservedConsistency.Conflict)
            {
                signals.Add(new TokenReviewSignal(
                    Id: "MINT_AUTHORITY_STATE_MISMATCH_WITH_DOCUMENTED_ISSUANCE",
                    Category: "review",
                    Severity: "medium",
                    Explanation: "Observed authority state conflicts with documented issuance behavior.",
                    Evidence: new Dictionary<string, string>
                    {
                        ["mintAuthorityRevoked"] = inspection.Authorities.MintAuthorityRevoked ? "true" : "false",
                        ["claimId"] = issuanceClaim.Id,
                        ["sourceIds"] = string.Join(",", issuanceClaim.SourceIds)
                    }));
            }
        }

        if (!inspection.Authorities.FreezeAuthorityRevoked)
        {
            signals.Add(new TokenReviewSignal(
                Id: "ACTIVE_FREEZE_AUTHORITY",
                Category: "review",
                Severity: "medium",
                Explanation: "Freeze authority is active, meaning token accounts can potentially be frozen by that authority.",
                Evidence: new Dictionary<string, string>
                {
                    ["freezeAuthority"] = inspection.Authorities.FreezeAuthority ?? "unknown"
                }));
        }

        if (inspection.Program.ProgramType == "token-2022")
        {
            signals.Add(new TokenReviewSignal(
                Id: "TOKEN_2022",
                Category: "informational",
                Severity: "info",
                Explanation: "This mint uses the Token-2022 program, which supports additional extension capabilities.",
                Evidence: new Dictionary<string, string>
                {
                    ["extensions"] = string.Join(",", inspection.Program.Token2022Extensions)
                }));
        }

        var topHolder = inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.LargestUnknownTokenAccountPercentage
            ?? inspection.HolderConcentration.TopHolderPercentage;

        if (topHolder is not null && topHolder.Value >= TokenInspectionThresholds.HighTopHolderConcentrationPercent)
        {
            signals.Add(new TokenReviewSignal(
                Id: "LARGE_TOKEN_ACCOUNT_BALANCE",
                Category: "informational",
                Severity: "info",
                Explanation: "A large share of supply appears in one unknown token account within getTokenLargestAccounts; beneficial ownership is not inferred.",
                Evidence: new Dictionary<string, string>
                {
                    ["largestTokenAccountPercentage"] = topHolder.Value.ToString("0.####", CultureInfo.InvariantCulture),
                    ["thresholdPercent"] = TokenInspectionThresholds.HighTopHolderConcentrationPercent.ToString("0.####", CultureInfo.InvariantCulture)
                }));
        }

        if (inspection.Age.AgeSeconds is long ageSeconds && ageSeconds >= 0 && ageSeconds < TokenInspectionThresholds.VeryNewTokenThreshold.TotalSeconds)
        {
            signals.Add(new TokenReviewSignal(
                Id: "VERY_NEW_TOKEN",
                Category: "informational",
                Severity: "info",
                Explanation: "This mint appears very new based on available creation-time evidence.",
                Evidence: new Dictionary<string, string>
                {
                    ["ageSeconds"] = ageSeconds.ToString(),
                    ["thresholdSeconds"] = ((long)TokenInspectionThresholds.VeryNewTokenThreshold.TotalSeconds).ToString()
                }));
        }

        return signals;
    }
}
