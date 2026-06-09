using OpenDentalSidecar.Api.Data;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

// ── Database ────────────────────────────────────────────────────
var connStr = builder.Configuration.GetConnectionString("OpenDental")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__OpenDental")
    ?? throw new InvalidOperationException("ConnectionStrings__OpenDental is not configured.");

builder.Services.AddScoped<IPatientRepository>(_ => new PatientRepository(connStr));
builder.Services.AddScoped<IAppointmentRepository>(_ => new AppointmentRepository(connStr));
builder.Services.AddScoped<IProcedureRepository>(_ => new ProcedureRepository(connStr));
builder.Services.AddScoped<IClaimRepository>(_ => new ClaimRepository(connStr));

// ── CORS (locked to frontend origin) ───────────────────────────
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:3000";
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(frontendUrl)
     .WithMethods("GET", "HEAD")
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
