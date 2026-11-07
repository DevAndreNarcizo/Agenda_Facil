<?php

declare(strict_types=1);

namespace Modules\CustomerPortal\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PortalOtpRequest extends Model
{
    use HasUuids;

    protected $fillable = ['organization_id', 'phone_hash', 'ip_hash'];
}
