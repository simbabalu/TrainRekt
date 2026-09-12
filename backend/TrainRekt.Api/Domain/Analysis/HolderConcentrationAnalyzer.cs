namespace TrainRekt.Api.Domain.Analysis;

public static class HolderConcentrationAnalyzer
{
    public static (decimal? Top1, decimal? Top5, decimal? Top10) Calculate(
        ulong supply,
        IReadOnlyList<ulong> largestRawAccountBalances)
    {
        if (supply == 0)
        {
            return (null, null, null);
        }

        var sorted = largestRawAccountBalances
            .OrderByDescending(static amount => amount)
            .ToArray();

        static decimal Percentage(ulong total, ulong part)
        {
            return Math.Round((part * 100m) / total, 4, MidpointRounding.AwayFromZero);
        }

        var top1 = sorted.Take(1).Aggregate(0UL, static (sum, value) => checked(sum + value));
        var top5 = sorted.Take(5).Aggregate(0UL, static (sum, value) => checked(sum + value));
        var top10 = sorted.Take(10).Aggregate(0UL, static (sum, value) => checked(sum + value));

        return (
            Percentage(supply, top1),
            Percentage(supply, top5),
            Percentage(supply, top10));
    }
}
