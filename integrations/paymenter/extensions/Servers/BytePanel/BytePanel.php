<?php

namespace Paymenter\Extensions\Servers\BytePanel;

use App\Classes\Extension\Server;
use App\Models\Service;
use Exception;
use Illuminate\Support\Facades\Http;

class BytePanel extends Server
{
    private const ENV_NAME = '/^[A-Z][A-Z0-9_]*$/';

    public function getConfig($values = []): array
    {
        return [
            [
                'name' => 'host',
                'label' => 'Panel URL',
                'type' => 'text',
                'description' => 'Your panel address, for example https://panel.example.com',
                'required' => true,
                'validation' => 'url',
            ],
            [
                'name' => 'api_key',
                'label' => 'API key',
                'type' => 'text',
                'description' => 'Generate one in BytePanel under Admin, Settings, Billing.',
                'required' => true,
                'encrypted' => true,
            ],
        ];
    }

    public function testConfig(): bool|string
    {
        try {
            $this->request('get', '/catalog');
        } catch (Exception $e) {
            return $e->getMessage();
        }

        return true;
    }

    public function getProductConfig($values = []): array
    {
        $catalog = $this->request('get', '/catalog');

        return [
            [
                'name' => 'plan',
                'label' => 'Plan',
                'type' => 'select',
                'options' => $this->options($catalog, 'plans', 'name'),
                'required' => true,
            ],
            [
                'name' => 'egg',
                'label' => 'Game',
                'type' => 'select',
                'description' => 'The game this product installs. Leave empty if customers choose at checkout.',
                'options' => $this->options($catalog, 'eggs', 'name'),
            ],
            [
                'name' => 'customer_can_select_egg',
                'label' => 'Let customers choose the game',
                'type' => 'checkbox',
                'description' => 'Shows a game picker at checkout. Games that need more than this plan offers are blocked.',
            ],
            [
                'name' => 'location',
                'label' => 'Location',
                'type' => 'select',
                'description' => 'Leave empty to use any location the plan allows.',
                'options' => $this->options($catalog, 'locations', 'long'),
            ],
            [
                'name' => 'customer_can_select_location',
                'label' => 'Let customers choose the location',
                'type' => 'checkbox',
                'description' => 'Shows a location picker at checkout, unless the plan is tied to one location.',
            ],
        ];
    }

    public function getCheckoutConfig($product, $values = [], $settings = []): array
    {
        if (empty($settings) && is_object($product) && isset($product->settings)) {
            $settings = $product->settings->pluck('value', 'key')->all();
        }
        $canGame = (bool) ($settings['customer_can_select_egg'] ?? false);
        $canLocation = (bool) ($settings['customer_can_select_location'] ?? false);
        if (!$canGame && !$canLocation) {
            return [];
        }

        $catalog = $this->request('get', '/catalog');
        $plan = null;
        foreach ($catalog['plans'] ?? [] as $item) {
            if ((string) ($item['id'] ?? '') === (string) ($settings['plan'] ?? '')) {
                $plan = $item;
            }
        }

        $fields = [];
        if ($canGame) {
            $hints = [];
            $disabled = [];
            foreach ($catalog['eggs'] ?? [] as $egg) {
                $id = (string) $egg['id'];
                $needs = [];
                if (($egg['minMemory'] ?? 0) > 0) {
                    $needs[] = $this->size((int) $egg['minMemory'], 'RAM') . ' min.';
                }
                if (($egg['minDisk'] ?? 0) > 0) {
                    $needs[] = $this->size((int) $egg['minDisk'], 'disk') . ' min.';
                }
                if ($needs) {
                    $hints[$id] = 'Requires: ' . implode(', ', $needs);
                }
                if ($plan && (
                    ($plan['memory'] ?? 0) < ($egg['minMemory'] ?? 0)
                    || ($plan['disk'] ?? 0) < ($egg['minDisk'] ?? 0)
                    || ($plan['allocationLimit'] ?? 0) < ($egg['ports'] ?? 1)
                )) {
                    $disabled[] = $id;
                }
            }
            $fields[] = [
                'name' => 'egg_id',
                'label' => 'Game',
                'type' => 'select',
                'options' => $this->options($catalog, 'eggs', 'name'),
                'option_hints' => $hints,
                'disabled_options' => $disabled,
                'required' => true,
            ];
        }

        if ($canLocation && empty($plan['locationId'])) {
            $fields[] = [
                'name' => 'location_id',
                'label' => 'Location',
                'type' => 'select',
                'options' => $this->options($catalog, 'locations', 'long'),
                'required' => true,
            ];
        }

        return $fields;
    }

    public function createServer(Service $service, $settings, $properties)
    {
        $egg = $this->choice($properties, 'egg_id', $settings, 'egg');
        if ($egg === '') {
            throw new Exception('No game was selected for this service');
        }
        $user = $service->user;
        $name = trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''));
        $payload = [
            'eggId' => $egg,
            'environment' => $this->environment($properties),
            'externalId' => $this->externalId($service),
            'planId' => (string) ($settings['plan'] ?? ''),
            'user' => [
                'email' => $user->email,
                'name' => mb_substr($name !== '' ? $name : $user->email, 0, 100),
            ],
        ];
        $location = $this->choice($properties, 'location_id', $settings, 'location');
        if ($location !== '') {
            $payload['locationId'] = $location;
        }

        $server = $this->request('post', '/servers', $payload)['server'] ?? null;
        if (!is_array($server) || empty($server['id'])) {
            throw new Exception('BytePanel did not return a server');
        }

        $service->properties()->updateOrCreate(
            ['key' => 'server_id'],
            ['name' => 'BytePanel Server ID', 'value' => $server['id']],
        );

        return [
            'server' => $server['id'],
            'link' => $server['url'] ?? '',
        ];
    }

    public function suspendServer(Service $service, $settings, $properties)
    {
        $this->request('post', $this->serverPath($service) . '/suspend');

        return true;
    }

    public function unsuspendServer(Service $service, $settings, $properties)
    {
        $this->request('delete', $this->serverPath($service) . '/suspend');

        return true;
    }

    public function terminateServer(Service $service, $settings, $properties)
    {
        $this->request('delete', $this->serverPath($service));
        $service->properties()->where('key', 'server_id')->delete();

        return true;
    }

    public function upgradeServer(Service $service, $settings, $properties)
    {
        $this->request('patch', $this->serverPath($service), ['planId' => (string) ($settings['plan'] ?? '')]);

        return true;
    }

    public function getActions(Service $service, $settings = [], $properties = []): array
    {
        if (empty($properties['server_id'])) {
            return [];
        }

        return [
            [
                'type' => 'button',
                'label' => 'Open control panel',
                'function' => 'ssoLink',
            ],
        ];
    }

    public function ssoLink(Service $service, $settings = [], $properties = []): string
    {
        try {
            $url = $this->request('post', $this->serverPath($service) . '/login')['url'] ?? '';
            if ($url !== '') {
                return $url;
            }
        } catch (Exception) {
        }

        return $this->baseUrl() . '/sign-in';
    }

    private function baseUrl(): string
    {
        return preg_replace('#/api/application$#', '', rtrim((string) $this->config('host'), '/'));
    }

    private function externalId(Service $service): string
    {
        return 'paymenter-' . $service->id;
    }

    private function serverPath(Service $service): string
    {
        return '/servers/' . rawurlencode($this->externalId($service));
    }

    private function request(string $method, string $path, ?array $data = null): array
    {
        $request = Http::withToken((string) $this->config('api_key'))->acceptJson()->timeout(60);
        $url = $this->baseUrl() . '/api/application' . $path;
        $response = $data === null
            ? $request->send(strtoupper($method), $url)
            : $request->send(strtoupper($method), $url, ['json' => $data]);

        if (!$response->successful()) {
            $message = $response->json('error');
            throw new Exception('BytePanel: ' . (is_string($message) && $message !== '' ? $message : 'request failed') . ' (HTTP ' . $response->status() . ')');
        }

        return $response->json() ?? [];
    }

    private function options(array $catalog, string $key, string $label): array
    {
        $options = [];
        foreach ($catalog[$key] ?? [] as $item) {
            if (!empty($item['id'])) {
                $options[(string) $item['id']] = (string) ($item[$label] ?? $item['id']);
            }
        }

        return $options;
    }

    private function choice(array $properties, string $chosen, array $settings, string $fixed): string
    {
        $value = trim((string) ($properties[$chosen] ?? ''));

        return $value !== '' ? $value : trim((string) ($settings[$fixed] ?? ''));
    }

    private function environment(array $properties): object
    {
        $environment = [];
        foreach ($properties as $key => $value) {
            if (is_string($key) && preg_match(self::ENV_NAME, $key) && is_scalar($value)) {
                $environment[$key] = (string) $value;
            }
        }

        return (object) $environment;
    }

    private function size(int $mib, string $unit): string
    {
        return ($mib >= 1024 ? round($mib / 1024, 1) . 'GB' : $mib . 'MB') . ' ' . $unit;
    }
}
