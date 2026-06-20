using OpenDentalSidecar.Api.Data;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Middleware;

using OpenDentalSidecar.Api.Data.Schema;

var builder = WebApplication.CreateBuilder(args);

// ── Database ────────────────────────────────────────────────────
var connStr = builder.Configuration.GetConnectionString("OpenDental")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__OpenDental")
    ?? throw new InvalidOperationException("ConnectionStrings__OpenDental is not configured.");

builder.Services.AddSingleton<SchemaIntrospector>(_ => new SchemaIntrospector(connStr));
builder.Services.AddScoped<IPatientRepository>(sp => new PatientRepository(connStr, sp.GetRequiredService<SchemaIntrospector>()));
builder.Services.AddScoped<IAppointmentRepository>(sp => new AppointmentRepository(connStr, sp.GetRequiredService<SchemaIntrospector>()));
builder.Services.AddScoped<IProcedureRepository>(_ => new ProcedureRepository(connStr));
builder.Services.AddScoped<IClaimRepository>(_ => new ClaimRepository(connStr));
builder.Services.AddScoped<IReferenceRepository>(_ => new ReferenceRepository(connStr));
builder.Services.AddScoped<IScheduleRepository>(sp =>
    new ScheduleRepository(connStr, sp.GetRequiredService<IReferenceRepository>()));
builder.Services.AddScoped<IAccountRepository>(sp => new AccountRepository(connStr, sp.GetRequiredService<SchemaIntrospector>()));
builder.Services.AddScoped<ICommlogRepository>(sp => new CommlogRepository(connStr, sp.GetRequiredService<SchemaIntrospector>()));
builder.Services.AddScoped<IRecallRepository>(_ => new RecallRepository(connStr));
builder.Services.AddScoped<IInsuranceRepository>(sp => new InsuranceRepository(connStr, sp.GetRequiredService<SchemaIntrospector>()));

// ── CORS (locked to frontend origin) ───────────────────────────
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:3000";
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(frontendUrl)
     .WithMethods("GET", "HEAD", "POST", "PUT", "DELETE")
     .WithHeaders("Authorization", "Content-Type")
     .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));

// ── Auth (scaffolding — Phase 2) ───────────────────────────────
builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

// ── Controllers ────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "OpenDental Sidecar API", Version = "v1" });
});

var app = builder.Build();

// ── Middleware pipeline ─────────────────────────────────────────
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<ReadOnlyGuardMiddleware>();
app.UseMiddleware<AuditMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
