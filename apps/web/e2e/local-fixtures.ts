import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, type BrowserContext } from '@playwright/test';

export interface LocalOwner {
  email: string;
  password: string;
  name: string;
  organization_name: string;
  slug: string;
}

/** Cria apenas novos atores sintéticos no banco local, sem consumir o rate limit dos fluxos sob teste. @author André Narcizo */
export function seedLocalOwner(input: LocalOwner): { user_id: string; organization_id: string } {
  if (!input.email.endsWith('@example.test') || !input.slug.startsWith('e2e-'))
    throw new Error('Fixtures exigem email example.test e slug e2e-.');
  const php = String.raw`
    require 'vendor/autoload.php';
    $app = require 'bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $db = config('database.connections.pgsql');
    $local = app()->environment(['local','testing']) && config('database.default') === 'pgsql'
      && ($db['database'] ?? null) === 'agenda_facil' && empty($db['url'])
      && in_array($db['host'], ['127.0.0.1','localhost'], true) && (string)$db['port'] === '55439';
    if (!$local) throw new RuntimeException('Fixtures recusadas fora do banco de desenvolvimento local.');
    $input = json_decode(file_get_contents('php://stdin'), true, 512, JSON_THROW_ON_ERROR);
    if (!str_ends_with($input['email'], '@example.test') || !str_starts_with($input['slug'], 'e2e-'))
      throw new RuntimeException('Identidade de fixture invalida.');
    Illuminate\Support\Facades\Http::preventStrayRequests();
    Illuminate\Support\Facades\Mail::fake();
    $result = Illuminate\Support\Facades\DB::transaction(function () use ($input) {
      $user = App\Models\User::create(['name'=>$input['name'],'email'=>$input['email'],'password'=>$input['password']]);
      $org = app(App\Domains\Organizations\Actions\CompleteOnboarding::class)->execute($user,
        ['name'=>$input['organization_name'],'slug'=>$input['slug'],'timezone'=>'America/Sao_Paulo']);
      return ['user_id'=>$user->id,'organization_id'=>$org->id];
    });
    echo json_encode($result, JSON_THROW_ON_ERROR);
  `;
  const output = execFileSync('php', ['-r', php], {
    cwd: resolve(process.cwd(), '../api'),
    env: process.env,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(output) as { user_id: string; organization_id: string };
}

export async function csrfHeaders(context: BrowserContext): Promise<Record<string, string>> {
  const response = await context.request.get('/sanctum/csrf-cookie');
  expect(response.status()).toBe(204);
  const cookie = (await context.cookies()).find((entry) => entry.name === 'XSRF-TOKEN');
  expect(Boolean(cookie), 'A sessão deve emitir cookie CSRF').toBe(true);
  return { 'X-XSRF-TOKEN': decodeURIComponent(cookie!.value), Accept: 'application/json' };
}

export async function loginLocalOwner(context: BrowserContext, owner: LocalOwner): Promise<void> {
  const response = await context.request.post('/api/v1/auth/login', {
    data: { email: owner.email, password: owner.password },
    headers: await csrfHeaders(context),
  });
  expect(response.status()).toBe(200);
}
