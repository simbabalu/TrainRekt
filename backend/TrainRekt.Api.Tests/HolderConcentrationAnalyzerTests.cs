using TrainRekt.Api.Domain.Analysis;

namespace TrainRekt.Api.Tests;

public sealed class HolderConcentrationAnalyzerTests
{
    [Fact]
    public void Calculate_ComputesTopConcentrationPercentages()
    {
        var result = HolderConcentrationAnalyzer.Calculate(
            supply: 1_000,
            largestRawAccountBalances: new ulong[] { 400, 200, 100, 50, 25, 10 });

        Assert.Equal(40m, result.Top1);
        Assert.Equal(77.5m, result.Top5);
        Assert.Equal(78.5m, result.Top10);
    }
}
