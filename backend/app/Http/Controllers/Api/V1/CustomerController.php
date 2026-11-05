<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Customers\Models\Customer;
use Modules\Organizations\Services\TenantContext;

/**
 * Clientes da organização. Qualquer membro pode consultar/cadastrar (equipe de atendimento).
 */
final class CustomerController extends Controller
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function index(Request $request): JsonResponse
    {
        $query = Customer::query()
            ->where('organization_id', $this->tenant->organization()->id);

        if ($search = $request->string('q')->trim()->value()) {
            $digits = Customer::normalizePhone($search);
            $query->where(function ($q) use ($search, $digits): void {
                $q->where('name', 'like', "%{$search}%");
                if ($digits !== null) {
                    $q->orWhere('phone_normalized', 'like', "%{$digits}%");
                }
            });
        }

        return response()->json(['data' => $query->orderBy('name')->limit(100)->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:190'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $customer = Customer::create([
            'organization_id' => $this->tenant->organization()->id,
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'phone_normalized' => Customer::normalizePhone($data['phone'] ?? null),
            'email' => $data['email'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json(['data' => $customer], 201);
    }
}
