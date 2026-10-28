<?php

declare(strict_types=1);

namespace App\Domains\Memberships\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Membership extends Model
{
    use HasUuids;

    protected $guarded = ['id'];
}
