<?php

declare(strict_types=1);

namespace App\Domains\CustomerPortal;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

final class PortalAccessMail extends Mailable
{
    public function __construct(public readonly string $accessUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Seu acesso ao portal Agenda Fácil');
    }

    public function content(): Content
    {
        return new Content(text: 'mail.portal-access', with: ['accessUrl' => $this->accessUrl]);
    }
}
