using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApiServices(builder.Configuration);

var app = builder.Build();

app.UseApiPipeline();
app.MapHealthEndpoints();
app.MapTokenInspectionEndpoints();

app.Run();

public partial class Program;
