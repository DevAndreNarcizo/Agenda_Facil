<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class BrandingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.private_disk' => 's3', 'filesystems.disks.s3.visibility' => 'private']);
        Storage::fake('s3');
    }

    private function tenant(string $slug): array
    {
        $user = User::factory()->create(['email' => 'brand-'.$slug.'@example.test']);
        $organization = app(CompleteOnboarding::class)->execute($user, ['name' => 'Marca sintética '.$slug, 'slug' => $slug]);
        $this->actingAs($user)->withSession(['organization_id' => $organization->id]);

        return [$user, $organization];
    }

    private function upload(): string
    {
        return $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('logo-sintetico.png')])
            ->assertCreated()->json('data.logo_file_id');
    }

    public function test_only_the_explicitly_selected_logo_is_public_and_the_object_stays_private(): void
    {
        [$owner, $organization] = $this->tenant('alpha');
        $id = $this->upload();
        $record = DB::table('private_files')->where('id', $id)->first();
        $this->assertSame('private', Storage::disk('s3')->getVisibility($record->path));
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('data.logo_file_id', $id)->assertJsonPath('data.logo_url', '/api/v1/public/alpha/logo');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->getJson('/api/v1/public/alpha')->assertOk()->assertJsonPath('data.organization.logo_url', '/api/v1/public/alpha/logo')
            ->assertJsonMissingPath('data.organization.logo_file_id')->assertJsonMissingPath('data.organization.owner_id');
        $download = $this->get('/api/v1/public/alpha/logo')->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame($record->sha256, hash('sha256', $download->streamedContent()));
        $this->getJson('/api/v1/files/'.$id)->assertUnauthorized();
        $this->tenant('beta');
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('data.logo_url', null);
        $this->get('/api/v1/public/beta/logo')->assertNotFound();
    }

    public function test_unselecting_preserves_private_history_and_selected_file_cannot_be_deleted(): void
    {
        $this->tenant('alpha');
        $first = $this->upload();
        $this->deleteJson('/api/v1/files/'.$first)->assertConflict();
        $second = $this->upload();
        $this->assertDatabaseCount('private_files', 2);
        $this->assertDatabaseHas('organizations', ['slug' => 'alpha', 'logo_file_id' => $second]);
        $this->deleteJson('/api/v1/branding/logo')->assertOk()->assertJsonPath('data.logo_url', null)->assertJsonPath('data.logo_file_id', null);
        $this->deleteJson('/api/v1/branding/logo')->assertOk();
        $this->assertDatabaseCount('private_files', 2);
        $this->get('/api/v1/public/alpha/logo')->assertNotFound();
        $this->deleteJson('/api/v1/files/'.$second)->assertOk();
    }

    public function test_roles_payloads_mime_and_dimensions_are_enforced(): void
    {
        [$owner, $organization] = $this->tenant('alpha');
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('valid.png'), 'organization_id' => $organization->id])->assertUnprocessable();
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('valid.png'), 'path' => '../other/logo.png'])->assertUnprocessable();
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->createWithContent('image.png', '<svg><script>synthetic</script></svg>')])->assertUnprocessable();
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('large.png')->size(2049)])->assertUnprocessable();
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('wide.png', 4097, 1)])->assertUnprocessable();
        Membership::where('organization_id', $organization->id)->where('user_id', $owner->id)->update(['role' => 'employee']);
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('valid.png')])->assertForbidden();
        $this->deleteJson('/api/v1/branding/logo')->assertForbidden();
        $this->assertDatabaseCount('private_files', 0);
    }

    public function test_disabling_public_booking_does_not_publish_the_logo(): void
    {
        [, $organization] = $this->tenant('alpha');
        $id = $this->upload();
        $this->patchJson('/api/v1/settings', ['public_booking_enabled' => false])->assertOk()->assertJsonPath('data.logo_url', null);
        $this->get('/api/v1/public/alpha/logo')->assertNotFound();
        $this->assertDatabaseHas('private_files', ['id' => $id, 'organization_id' => $organization->id]);
    }

    public function test_database_foreign_key_rejects_a_logo_from_another_tenant(): void
    {
        [, $alpha] = $this->tenant('alpha');
        $this->tenant('beta');
        $other = $this->upload();
        $this->expectException(QueryException::class);
        DB::table('organizations')->where('id', $alpha->id)->update(['logo_file_id' => $other]);
    }

    public function test_failed_logo_selection_compensates_new_object_and_preserves_existing_logo(): void
    {
        $this->tenant('alpha');
        $first = $this->upload();
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION pg_temp.reject_logo_selection() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'synthetic logo selection failure'; END $$;
            CREATE TRIGGER synthetic_reject_logo BEFORE UPDATE OF logo_file_id ON organizations
            FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_logo_selection();
            SQL);
        $this->postJson('/api/v1/branding/logo', ['file' => UploadedFile::fake()->image('second.png')])->assertStatus(503);
        $this->assertDatabaseHas('organizations', ['slug' => 'alpha', 'logo_file_id' => $first]);
        $this->assertDatabaseCount('private_files', 1);
        $this->assertCount(1, Storage::disk('s3')->allFiles());
    }
}
