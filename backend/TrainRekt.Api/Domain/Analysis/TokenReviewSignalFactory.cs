using System.Globalization;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Domain.Analysis;

public static class TokenReviewSignalFactory
{
    public static IReadOnlyList<TokenReviewSignal> Create(TokenInspection inspection)
    {
        var signals = new List<TokenReviewSignal>();

        var issuanceContext = inspection.ProtocolContext?.Issuance;
        var hasDocumentedInflationaryIssuance = issuanceContext is not null
            && string.Equals(inspection.ProtocolContext?.Protocol, ProtocolConstants.SolanaMobileSkrProtocolName, StringComparison.Ordinal)
            && string.Equals(issuanceContext.Classification, "documented_inflationary_issuance", StringComparison.Ordinal)
            && string.Equals(issuanceContext.Verification, "official_documentation", StringComparison.Ordinal);

        if (!inspection.Authorities.MintAuthorityRevoked)
        {
            var explanation = "Mint authority is active, meaning additional supply can still be minted.";
            var category = "review";
            var severity = "medium";

            if (hasDocumentedInflationaryIssuance)
            {
                explanation = "Mint authority is active. Official Solana Mobile documentation describes ongoing SKR issuance for staking rewards.";
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

        if (hasDocumentedInflationaryIssuance && issuanceContext is not null)
        {
            var evidence = new Dictionary<string, string>
            {
                ["protocol"] = ProtocolConstants.SolanaMobileSkrProtocolName,
                ["sourceType"] = issuanceContext.Verification,
                ["sourceIds"] = string.Join(",", issuanceContext.SourceIds),
                ["mintAuthorityStateConsistentWithDocumentedModel"] = issuanceContext.MintAuthorityStateConsistentWithDocumentedModel ? "true" : "false",
                ["mintAuthorityIdentityVerified"] = issuanceContext.MintAuthorityIdentityVerified ? "true" : "false"
            };

            if (!string.IsNullOrWhiteSpace(issuanceContext.MintAuthorityIdentityVerificationNote))
            {
                evidence["mintAuthorityIdentityVerificationNote"] = issuanceContext.MintAuthorityIdentityVerificationNote;
            }

            signals.Add(new TokenReviewSignal(
                Id: "DOCUMENTED_INFLATIONARY_ISSUANCE",
                Category: "informational",
                Severity: "info",
                Explanation: "Official Solana Mobile sources document SKR inflationary issuance and staking rewards.",
                Evidence: evidence));

            if (!issuanceContext.MintAuthorityStateConsistentWithDocumentedModel)
            {
                signals.Add(new TokenReviewSignal(
                    Id: "MINT_AUTHORITY_STATE_MISMATCH_WITH_DOCUMENTED_ISSUANCE",
                    Category: "review",
                    Severity: "medium",
                    Explanation: "Official SKR sources describe ongoing issuance, but this mint currently has no active mint authority.",
                    Evidence: new Dictionary<string, string>
                    {
                        ["mintAuthorityRevoked"] = "true",
                        ["sourceIds"] = string.Join(",", issuanceContext.SourceIds)
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
