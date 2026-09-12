using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Tests;

public sealed class TokenResearchSnapshotDocumentTests
{
    [Fact]
    public void SnapshotDocument_BsonRoundTrip_PreservesResearchContextAndVersion()
    {
        var researchedAt = new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero);

        var context = new ProtocolResearchContext(
            Protocol: "example",
            Sources: new[]
            {
                new ResearchSource(
                    Id: "src",
                    SourceType: ResearchSourceType.OfficialDocumentation,
                    Title: "Docs",
                    Publisher: "Org",
                    Url: "https://example.com/docs",
                    RetrievedAtUtc: null,
                    PublishedAtUtc: null)
            },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "Ongoing issuance is documented.",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { "src" },
                    ObservedFactReferences: new[]
                    {
                        new ObservedFactReference(ObservedFactIds.MintAuthorityActive, "true", "true", null)
                    },
                    VerificationNote: "note",
                    Consistency: ObservedConsistency.Consistent)
            });

        var document = new TokenResearchSnapshotDocument
        {
            Id = "507f1f77bcf86cd799439012",
            Mint = "ResearchMint1111111111111111111111111111111",
            Protocol = "example",
            ResearchVersion = TokenResearchVersion.Current,
            ResearchedAtUtc = researchedAt.UtcDateTime,
            CachedAtUtc = researchedAt.UtcDateTime,
            ExpiresAtUtc = researchedAt.AddHours(24).UtcDateTime,
            Context = context
        };

        var bson = document.ToBson();
        var roundTrip = BsonSerializer.Deserialize<TokenResearchSnapshotDocument>(bson);

        Assert.Equal(TokenResearchVersion.Current, roundTrip.ResearchVersion);
        Assert.Equal("src", roundTrip.Context.Sources[0].Id);
        Assert.Equal(ObservedConsistency.Consistent, roundTrip.Context.Claims[0].Consistency);
    }
}
