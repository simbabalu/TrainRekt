namespace TrainRekt.Api.Api.Configuration;

public static class ApplicationBuilderExtensions
{
    public static WebApplication UseApiPipeline(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseHttpsRedirection();

        if (app.Environment.IsDevelopment())
        {
            app.UseCors(ServiceCollectionExtensions.DevelopmentCorsPolicy);
        }

        return app;
    }
}
