<?php

class Bytepanel extends Module
{
    private const ENV_NAME = '/^[A-Z][A-Z0-9_]*$/';

    public function __construct()
    {
        $this->loadConfig(dirname(__FILE__) . DS . 'config.json');
        Loader::loadComponents($this, ['Input']);
        Language::loadLang('bytepanel', null, dirname(__FILE__) . DS . 'language' . DS);
    }

    public function manageModule($module, array &$vars)
    {
        $view = $this->view('manage');
        $view->set('module', $module);

        return $view->fetch();
    }

    public function manageAddRow(array &$vars)
    {
        $view = $this->view('row');
        $view->set('title', Language::_('Bytepanel.row.add_title', true));
        $view->set('vars', (object) $vars);

        return $view->fetch();
    }

    public function manageEditRow($module_row, array &$vars)
    {
        $view = $this->view('row');
        $view->set('title', Language::_('Bytepanel.row.edit_title', true));
        $view->set('vars', (object) (empty($vars) ? (array) $module_row->meta : $vars));

        return $view->fetch();
    }

    public function addModuleRow(array &$vars)
    {
        return $this->saveRow($vars);
    }

    public function editModuleRow($module_row, array &$vars)
    {
        return $this->saveRow($vars);
    }

    public function deleteModuleRow($module_row)
    {
        return null;
    }

    public function getPackageFields($vars = null)
    {
        Loader::loadHelpers($this, ['Html']);
        $fields = new ModuleFields();
        $row = $this->packageRow($vars);
        $catalog = [];
        if ($row) {
            try {
                $catalog = $this->request($row, 'GET', '/catalog');
            } catch (Exception $e) {
                $this->Input->setErrors(['api' => ['catalog' => $e->getMessage()]]);
            }
        }
        $meta = isset($vars->meta) ? (array) $vars->meta : [];

        foreach ([
            'plan' => ['plans', 'name', false],
            'egg' => ['eggs', 'name', true],
            'location' => ['locations', 'long', true],
        ] as $key => [$list, $label, $optional]) {
            $field = $fields->label(Language::_('Bytepanel.package.' . $key, true), 'bytepanel_' . $key);
            $field->attach($fields->fieldSelect(
                'meta[' . $key . ']',
                $this->options($catalog, $list, $label, $optional),
                $meta[$key] ?? null,
                ['id' => 'bytepanel_' . $key]
            ));
            $field->attach($fields->tooltip(Language::_('Bytepanel.package.' . $key . '_tooltip', true)));
            $fields->setField($field);
        }

        return $fields;
    }

    public function addPackage(array $vars = null)
    {
        return $this->packageMeta($vars ?? []);
    }

    public function editPackage($package, array $vars = null)
    {
        return $this->packageMeta($vars ?? []);
    }

    public function getAdminAddFields($package, $vars = null)
    {
        return $this->nameField($vars);
    }

    public function getClientAddFields($package, $vars = null)
    {
        return $this->nameField($vars);
    }

    public function getAdminEditFields($package, $vars = null)
    {
        return new ModuleFields();
    }

    public function validateService($package, array $vars = null)
    {
        $name = trim((string) ($vars['bytepanel_name'] ?? ''));
        if ($name !== '' && (mb_strlen($name) < 3 || mb_strlen($name) > 40)) {
            $this->Input->setErrors(['bytepanel_name' => ['length' => Language::_('Bytepanel.service.name_length', true)]]);

            return false;
        }

        return true;
    }

    public function addService($package, array $vars = null, $parent_package = null, $parent_service = null, $status = 'pending')
    {
        $vars = $vars ?? [];
        if (!$this->validateService($package, $vars)) {
            return null;
        }
        $externalId = trim((string) ($vars['bytepanel_external_id'] ?? ''));
        if ($externalId === '') {
            $externalId = 'blesta-' . bin2hex(random_bytes(8));
        }
        $name = trim((string) ($vars['bytepanel_name'] ?? ''));
        $serverId = '';

        if (($vars['use_module'] ?? 'false') === 'true') {
            $options = (array) ($vars['configoptions'] ?? []);
            $egg = $this->choice($options, 'egg', $package->meta->egg ?? '');
            if ($egg === '') {
                $this->Input->setErrors(['api' => ['egg' => Language::_('Bytepanel.service.no_game', true)]]);

                return null;
            }
            Loader::loadModels($this, ['Clients']);
            $client = $this->Clients->get($vars['client_id'], false);
            $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));
            $payload = [
                'eggId' => $egg,
                'environment' => $this->environment($options),
                'externalId' => $externalId,
                'planId' => (string) ($package->meta->plan ?? ''),
                'user' => [
                    'email' => $client->email,
                    'name' => mb_substr($clientName !== '' ? $clientName : $client->email, 0, 100),
                ],
            ];
            $location = $this->choice($options, 'location', $package->meta->location ?? '');
            if ($location !== '') {
                $payload['locationId'] = $location;
            }
            if ($name !== '') {
                $payload['name'] = $name;
            }

            try {
                $server = $this->request($this->getModuleRow(), 'POST', '/servers', $payload)['server'] ?? [];
            } catch (Exception $e) {
                $this->Input->setErrors(['api' => ['create' => $e->getMessage()]]);

                return null;
            }
            $serverId = (string) ($server['id'] ?? '');
            $name = (string) ($server['name'] ?? $name);
        }

        return [
            ['key' => 'bytepanel_name', 'value' => $name, 'encrypted' => 0],
            ['key' => 'bytepanel_external_id', 'value' => $externalId, 'encrypted' => 0],
            ['key' => 'bytepanel_server_id', 'value' => $serverId, 'encrypted' => 0],
        ];
    }

    public function editService($package, $service, array $vars = null, $parent_package = null, $parent_service = null)
    {
        $fields = [];
        foreach ($service->fields as $field) {
            $fields[] = ['key' => $field->key, 'value' => $field->value, 'encrypted' => $field->encrypted];
        }

        return $fields;
    }

    public function cancelService($package, $service, $parent_package = null, $parent_service = null)
    {
        return $this->serviceAction($service, 'DELETE', '');
    }

    public function suspendService($package, $service, $parent_package = null, $parent_service = null)
    {
        return $this->serviceAction($service, 'POST', '/suspend');
    }

    public function unsuspendService($package, $service, $parent_package = null, $parent_service = null)
    {
        return $this->serviceAction($service, 'DELETE', '/suspend');
    }

    public function changeServicePackage($package_from, $package_to, $service, $parent_package = null, $parent_service = null)
    {
        return $this->serviceAction($service, 'PATCH', '', ['planId' => (string) ($package_to->meta->plan ?? '')]);
    }

    public function getClientTabs($package)
    {
        return ['tabClientLogin' => Language::_('Bytepanel.tab.login', true)];
    }

    public function tabClientLogin($package, $service, array $get = null, array $post = null, array $files = null)
    {
        $view = $this->view('tab_client_login');
        if (!empty($post['open_panel'])) {
            try {
                $url = $this->request(
                    $this->getModuleRow($service->module_row_id),
                    'POST',
                    $this->serverPath($service) . '/login'
                )['url'] ?? '';
                if ($url !== '') {
                    header('Location: ' . $url);
                    exit;
                }
                $view->set('error', Language::_('Bytepanel.tab.no_link', true));
            } catch (Exception $e) {
                $view->set('error', $e->getMessage());
            }
        }
        $view->set('service_id', (int) $service->id);
        $view->set('base_uri', $this->base_uri);

        return $view->fetch();
    }

    private function view(string $name)
    {
        $view = new View($name, 'default');
        $view->base_uri = $this->base_uri;
        $view->setDefaultView('components' . DS . 'modules' . DS . 'bytepanel' . DS);
        Loader::loadHelpers($view, ['Form', 'Html', 'Widget']);

        return $view;
    }

    private function saveRow(array &$vars)
    {
        $vars['panel_name'] = trim((string) ($vars['panel_name'] ?? ''));
        $vars['url'] = rtrim(trim((string) ($vars['url'] ?? '')), '/');
        $vars['api_key'] = trim((string) ($vars['api_key'] ?? ''));

        $this->Input->setRules([
            'panel_name' => ['empty' => ['rule' => 'isEmpty', 'negate' => true, 'message' => Language::_('Bytepanel.row.error_name', true)]],
            'url' => ['valid' => ['rule' => [[$this, 'validUrl']], 'message' => Language::_('Bytepanel.row.error_url', true)]],
            'api_key' => ['valid' => ['rule' => [[$this, 'validKey'], $vars['url']], 'message' => Language::_('Bytepanel.row.error_key', true)]],
        ]);
        if (!$this->Input->validates($vars)) {
            return null;
        }

        return [
            ['key' => 'panel_name', 'value' => $vars['panel_name'], 'encrypted' => 0],
            ['key' => 'url', 'value' => $vars['url'], 'encrypted' => 0],
            ['key' => 'api_key', 'value' => $vars['api_key'], 'encrypted' => 1],
        ];
    }

    public function validUrl($url)
    {
        return (bool) preg_match('#^https?://[^\s/]+#i', (string) $url);
    }

    public function validKey($key, $url)
    {
        if ($key === '' || !$this->validUrl($url)) {
            return false;
        }
        try {
            $this->request((object) ['meta' => (object) ['url' => $url, 'api_key' => $key]], 'GET', '/catalog');
        } catch (Exception $e) {
            return false;
        }

        return true;
    }

    private function packageRow($vars)
    {
        if (!empty($vars->module_row)) {
            return $this->getModuleRow($vars->module_row);
        }
        $rows = $this->getModuleRows($vars->module_group ?? null);

        return $rows[0] ?? null;
    }

    private function packageMeta(array $vars)
    {
        $meta = (array) ($vars['meta'] ?? []);
        if (trim((string) ($meta['plan'] ?? '')) === '') {
            $this->Input->setErrors(['meta' => ['plan' => Language::_('Bytepanel.package.error_plan', true)]]);

            return null;
        }
        $out = [];
        foreach (['plan', 'egg', 'location'] as $key) {
            $out[] = ['key' => $key, 'value' => trim((string) ($meta[$key] ?? '')), 'encrypted' => 0];
        }

        return $out;
    }

    private function nameField($vars)
    {
        $fields = new ModuleFields();
        $field = $fields->label(Language::_('Bytepanel.service.name', true), 'bytepanel_name');
        $field->attach($fields->fieldText('bytepanel_name', $vars->bytepanel_name ?? null, ['id' => 'bytepanel_name']));
        $field->attach($fields->tooltip(Language::_('Bytepanel.service.name_tooltip', true)));
        $fields->setField($field);

        return $fields;
    }

    private function serviceAction($service, string $method, string $suffix, ?array $body = null)
    {
        try {
            $this->request($this->getModuleRow($service->module_row_id), $method, $this->serverPath($service) . $suffix, $body);
        } catch (Exception $e) {
            $this->Input->setErrors(['api' => ['request' => $e->getMessage()]]);
        }

        return null;
    }

    private function serverPath($service)
    {
        $fields = $this->serviceFieldsToObject($service->fields);

        return '/servers/' . rawurlencode((string) ($fields->bytepanel_external_id ?? ''));
    }

    private function choice(array $options, string $name, $fallback)
    {
        $chosen = trim((string) ($options[$name] ?? ''));

        return $chosen !== '' ? $chosen : trim((string) $fallback);
    }

    private function environment(array $options)
    {
        $environment = [];
        foreach ($options as $key => $value) {
            if (is_string($key) && preg_match(self::ENV_NAME, $key) && is_scalar($value)) {
                $environment[$key] = (string) $value;
            }
        }

        return (object) $environment;
    }

    private function options(array $catalog, string $key, string $label, bool $optional)
    {
        $options = $optional ? ['' => Language::_('Bytepanel.package.none', true)] : [];
        foreach ($catalog[$key] ?? [] as $item) {
            if (!empty($item['id'])) {
                $options[(string) $item['id']] = (string) ($item[$label] ?? $item['id']);
            }
        }

        return $options;
    }

    private function request($row, string $method, string $path, ?array $body = null)
    {
        if (!$row || empty($row->meta->url)) {
            throw new Exception(Language::_('Bytepanel.row.missing', true));
        }
        $url = preg_replace('#/api/application$#', '', rtrim($row->meta->url, '/')) . '/api/application' . $path;
        $headers = ['Accept: application/json', 'Authorization: Bearer ' . $row->meta->api_key];
        $encoded = $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES);
        if ($encoded !== null) {
            $headers[] = 'Content-Type: application/json';
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 60,
        ]);
        if ($encoded !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $encoded);
        }
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $success = $raw !== false && $status >= 200 && $status < 300;
        $this->log($method . ' ' . $path, $encoded ?? '', 'input', true);
        $this->log($method . ' ' . $path, is_string($raw) ? $raw : $error, 'output', $success);

        if ($raw === false) {
            throw new Exception('Could not reach BytePanel: ' . $error);
        }
        $decoded = json_decode($raw, true);
        if (!$success) {
            $message = is_array($decoded) && is_string($decoded['error'] ?? null) ? $decoded['error'] : 'request failed';
            throw new Exception('BytePanel: ' . $message . ' (HTTP ' . $status . ')');
        }

        return is_array($decoded) ? $decoded : [];
    }
}
