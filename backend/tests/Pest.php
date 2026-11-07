<?php

declare(strict_types=1);

use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
| Vincula o TestCase (que inicializa a aplicação Laravel) às suítes de teste,
| garantindo que o container/facades (db, etc.) estejam disponíveis.
*/

pest()->extend(TestCase::class)->in('Feature', 'Unit');
