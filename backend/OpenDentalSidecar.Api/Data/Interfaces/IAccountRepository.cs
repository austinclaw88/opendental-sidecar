using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IAccountRepository
{
    Task<AccountSummaryDto?> GetFamilyAccount(long patNum);
    Task<IReadOnlyList<FamilyMemberDto>> GetFamily(long patNum);
    Task<long> CreatePayment(CreatePaymentRequest req);
    Task<long> CreateAdjustment(CreateAdjustmentRequest req);
}
