<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domains\Memberships\Models\Membership;
use App\Domains\Organizations\Actions\CompleteOnboarding;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

final class PrivateFilesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.private_disk' => 's3', 'filesystems.disks.s3.visibility' => 'private']);
        Storage::fake('s3');
    }

    public function test_private_upload_generates_tenant_path_and_authorized_download_without_public_url(): void
    {
        [$owner, $org] = $this->tenant();
        $this->actingAs($owner)->withSession(['organization_id' => $org]);
        $file = UploadedFile::fake()->image('synthetic-name.png');
        $result = $this->postJson('/api/v1/files', ['file' => $file])->assertCreated()->assertJsonMissingPath('data.path')->assertJsonMissingPath('data.disk');
        $id = $result->json('data.id');
        $record = DB::table('private_files')->where('id', $id)->first();
        $this->assertSame($org.'/'.$id.'.png', $record->path);
        Storage::disk('s3')->assertExists($record->path);
        $this->assertSame('private', Storage::disk('s3')->getVisibility($record->path));
        $download = $this->get('/api/v1/files/'.$id)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff')->assertDownload($id.'.png');
        $this->assertSame(hash('sha256', $file->get()), hash('sha256', $download->streamedContent()));
        $this->getJson('/api/v1/files')->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.path');
        $this->deleteJson('/api/v1/files/'.$id)->assertOk();
        Storage::disk('s3')->assertMissing($record->path);
        $this->assertDatabaseCount('private_files', 0);
    }

    public function test_two_organizations_are_isolated_for_download_list_and_delete(): void
    {
        [$ownerA, $orgA] = $this->tenant();
        $id = $this->actingAs($ownerA)->withSession(['organization_id' => $orgA])->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('synthetic.png')])->assertCreated()->json('data.id');
        [$ownerB, $orgB] = $this->tenant();
        $this->actingAs($ownerB)->withSession(['organization_id' => $orgB])->withHeader('X-Organization-Id', $orgA);
        $this->getJson('/api/v1/files')->assertExactJson(['data' => []]);
        $this->getJson('/api/v1/files/'.$id)->assertNotFound();
        $this->deleteJson('/api/v1/files/'.$id)->assertNotFound();
        $this->assertDatabaseHas('private_files', ['id' => $id, 'organization_id' => $orgA]);
    }

    public function test_employee_can_read_authorized_file_but_cannot_upload_or_delete(): void
    {
        [$owner, $org] = $this->tenant();
        $this->actingAs($owner)->withSession(['organization_id' => $org]);
        $id = $this->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('synthetic.png')])->assertCreated()->json('data.id');
        Membership::where('organization_id', $org)->where('user_id', $owner->id)->update(['role' => 'employee']);
        $this->get('/api/v1/files/'.$id)->assertOk();
        $this->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('other.png')])->assertForbidden();
        $this->deleteJson('/api/v1/files/'.$id)->assertForbidden();
        Membership::where('organization_id', $org)->where('user_id', $owner->id)->update(['status' => 'revoked']);
        $this->get('/api/v1/files/'.$id, ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_svg_disguised_code_oversize_and_client_paths_are_rejected(): void
    {
        [$owner, $org] = $this->tenant();
        $this->actingAs($owner)->withSession(['organization_id' => $org]);
        // Um UploadedFile real faz detecção de MIME pelo conteúdo, sem o override por nome do FileFake.
        foreach (['image.png' => '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'avatar.jpg' => '<?php echo "synthetic";'] as $name => $content) {
            $path = tempnam(sys_get_temp_dir(), 'agenda-upload-test-');
            file_put_contents($path, $content);
            try {
                $this->postJson('/api/v1/files', ['file' => new UploadedFile($path, $name, null, null, true)])->assertUnprocessable();
            } finally {
                unlink($path);
            }
        }
        $this->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('large.png')->size(2049)])->assertUnprocessable();
        $this->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('valid.png'), 'organization_id' => (string) Str::uuid(), 'path' => '../another-tenant/file', 'disk' => 'public'])->assertUnprocessable();
        $this->assertDatabaseCount('private_files', 0);
        $this->assertSame([], Storage::disk('s3')->allFiles());
    }

    public function test_s3_write_failure_does_not_create_metadata(): void
    {
        [$owner, $org] = $this->tenant();
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('put')->once()->andReturn(false);
        $disk->shouldReceive('delete')->once()->andReturn(true);
        Storage::shouldReceive('disk')->with('s3')->andReturn($disk);
        $this->actingAs($owner)->withSession(['organization_id' => $org])->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('synthetic.png')])->assertStatus(503);
        $this->assertDatabaseCount('private_files', 0);
    }

    public function test_metadata_failure_compensates_the_private_object(): void
    {
        [$owner, $org] = $this->tenant();
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION pg_temp.reject_private_insert() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'synthetic metadata failure'; END $$;
            CREATE TRIGGER synthetic_reject_private_insert BEFORE INSERT ON private_files
            FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_private_insert();
            SQL);
        $this->actingAs($owner)->withSession(['organization_id' => $org])->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('synthetic.png')])->assertStatus(503);
        $this->assertDatabaseCount('private_files', 0);
        $this->assertSame([], Storage::disk('s3')->allFiles());
    }

    public function test_production_requires_s3_and_rejects_a_public_disk(): void
    {
        [$owner, $org] = $this->tenant();
        $this->actingAs($owner)->withSession(['organization_id' => $org]);
        config(['filesystems.private_disk' => 'local']);
        Storage::fake('local');
        $this->app->instance('env', 'production');
        $token = Str::random(40);
        $this->withSession(['organization_id' => $org, '_token' => $token])->withHeader('X-CSRF-TOKEN', $token);
        $this->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('synthetic.png')])->assertStatus(503);
        $this->app->instance('env', 'testing');
        config(['filesystems.private_disk' => 'public']);
        $this->postJson('/api/v1/files', ['file' => UploadedFile::fake()->image('synthetic.png')])->assertStatus(503);
        $this->assertDatabaseCount('private_files', 0);
    }

    private function tenant(): array
    {
        $user = User::create(['name' => 'Owner arquivo sintético', 'email' => 'file-'.Str::uuid().'@agenda.test', 'password' => 'synthetic-password-only']);
        $org = app(CompleteOnboarding::class)->execute($user, ['name' => 'Arquivos sintéticos', 'slug' => 'files-'.Str::uuid()]);

        return [$user, $org->id];
    }
}
