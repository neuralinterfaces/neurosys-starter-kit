import './style.css'

import { getAllServerSidePlugins, System, devices, Recording, Client } from 'neurosys'
import { DeviceList, DeviceDiscoveryList, createModal } from './ui'
import { JSONSchemaForm } from './ui/JSONSchemaForm'
// import { JSONSchemaForm } from './ui/JSONSchemaForm'


// // Example Search Params: ?output=textFeedback&output=inspectFeedback&score=alphaScore
// const searchParams = new URLSearchParams(window.location.search)

// const urlSettings = {
//     outputs: searchParams.getAll('output').reduce((acc, key) => ({ ...acc, [key]: { enabled: true } }), {}),
//     score: searchParams.getAll('score').reduce((acc, key) => ({ ...acc, [key]: { enabled: true } }), {})
// }

// const hasUrlSettings = Object.values(urlSettings).some((o) => Object.keys(o).length > 0)



const neurosys = new System()

const calculate = async () => {

  const { __client } = neurosys
  if (!__client) return

  await neurosys.calculate(__client) // Calculate for all protocols

  // const protocol = neurosys.get() // Get the protocol
  // if (!protocol) return
  // await protocol.calculate(client) // Calculate the protocol

}

const setOutputState = async ({ id, enabled }) => {

  const ref = neurosys.plugins.output[id]

  if (!ref) return

  const { __ctx, __latest } = ref

  // Ensure the appropriate callback is called before the state is toggled
  ref.enabled = enabled
  const protocol = neurosys.get()
  const { changed } = protocol.update('outputs', id, { enabled })
  if (changed) await setSaveSettingsState(true) // Enable settings save button because of changes


  if (!changed) return
  if (!enabled) return
  if (!__latest) return

  ref.set.call(__ctx, __latest) // Re-set the latest features to the output
}

const setEvaluationState = async ({ id, enabled }) => {

  const ref = neurosys.plugins.evaluation[id]

  if (!ref) return

  const protocol = neurosys.get()
  const { changed } = protocol.update('evaluations', id, { enabled })

  if (changed) await setSaveSettingsState(true) // Enable settings save button because of changes

  ref.enabled = enabled
  calculate() // Run the protocol immediately after toggling
}

const SETTINGS_FILE_PREFIX = 'settings'

const { SERVICES, READY } = commoners

const UPDATE_INVERVAL = 250

const loadStart = performance.now()


const setSaveSettingsState = async (state: boolean) => {
  const { menu } = await READY
  menu.set('saveSettings', { ...MENU_STATES.saveSettings.save, enabled: state })
}
  

const MENU_STATES = {

  // Custom Menu Items
  device: {
    connect: {
      label: 'Connect Device',

      // Allow Device Type Selection with a User Action (to bypass security restrictions)
      onClick: async () => {
        const { menu } = await READY
        const { device, protocol } = await new Promise((resolve, reject) => {
          const list = new DeviceList({
            devices: neurosys.plugins.devices,

            // Success
            onSelect: async (device, protocol) => {
              resolve({ device, protocol })
              modal.close()
            }
          })

          const modal = createModal({ header: 'Neurofeedback Devices', content: list })

          modal.addEventListener('close', () => {
            modal.remove()
            reject('No device selected')
          })

          document.body.append(modal)
          modal.showModal()
        })

        const client = new Client(device)
        await client.connect(protocol)
        neurosys.__client = client

        menu.set('recording', { ...MENU_STATES.recording.start, enabled: true })
        menu.set('device', MENU_STATES.device.disconnect)
      }
    },
    disconnect: {
      label: 'Disconnect Device',
      onClick: async () => {
        const { menu } = await READY
        const { __client } = neurosys
        if (!__client) return
        await __client.disconnect()
        delete neurosys.__client
        neurosys.reset()
        menu.set('recording', MENU_STATES.recording.start)
        menu.set('device', MENU_STATES.device.connect)
      }
    }
  },

  recording: {
    start: {
      label: 'Start Recording',
      enabled: false,
      onClick: async () => {
        const { menu } = await READY
        if (!neurosys.__client) return console.error('No client available')

        neurosys.__recording = new Recording(neurosys.__client)
        neurosys.__recording.start()
        
        menu.set('recording', MENU_STATES.recording.stop)
      }
    },
    stop: {
      label: 'Stop Recording',
      onClick: async () => {
        const { menu } = await READY

        const { __recording } = neurosys
        if (!__recording) return
        __recording.save()
        __recording.stop()
        delete neurosys.__recording

        menu.set('recording', { ...MENU_STATES.recording.start, enabled: true })
      }
    }
  },

  settings: {
    edit: {

      label: 'Edit Settings',

      async onClick() {

          if (this.open) return

          const allProtocols = neurosys.getAll()

           const allOutputPlugins = neurosys.plugins.output
           const aggregatedInfo = Object.entries(allOutputPlugins)
           .sort(([ _, a ], [ __, b ]) => {
              const aProps = a.settings?.properties
              const bProps = b.settings?.properties
              if (aProps && bProps) return a.label.localeCompare(b.label)
              if (aProps) return -1
              if (bProps) return 1
              return 0
           })
           
           .reduce((acc, [ key, plugin ]) => {

              const { label, settings: schema } = plugin

              const { __uiSchema = {}, ...rest } = schema

              const info = { type: 'object', title: label, properties: {}, ...rest }
              if (Object.keys(info.properties).length === 0) Object.assign(info, { description: 'No settings available' })

              const data = allProtocols.reduce((acc, protocol, i) => {
                const { settings = {} } = protocol.outputs.get(key) ?? {}
                return { ...acc, [i]: settings }
              }, {})


              return {
                properties: { 
                  ...acc.properties, 
                  [key]: {
                    type: 'object',
                    title: label,
                    properties: allProtocols.reduce((acc, _, i) => ({ 
                      ...acc, 
                      [i]: {
                        ...info,
                        title: `Protocol ${i + 1}`
                      }
                    }), {})
                  }
                },
                uiSchema: { 
                  ...acc.uiSchema, 
                  [key]: allProtocols.reduce((acc, _, i) => ({ ...acc,  [i]: __uiSchema }), {}) 
                },
                data: { ...acc.data, [key]: data }
              }

            }, { properties: {}, uiSchema: {}, data: {} })
            
           const form = new JSONSchemaForm({ 
              data: aggregatedInfo.data, 
              schema: { type: "object", properties: aggregatedInfo.properties },
              ui: aggregatedInfo.uiSchema,
              submitButton: false
            })


          const updateProtocolsWithNewFormData = (formData: any) => {
            let hasSaveableChange = false
            for (const pluginName in formData) {

              const plugin = neurosys.plugins.output[pluginName]
              if (!plugin) continue

              for (const protocolIdx in formData[pluginName]) {
                const data = formData[pluginName][protocolIdx]

                const protocol = allProtocols[protocolIdx]
                if (!protocol) continue

                const { changed } = protocol.update('outputs', pluginName, { settings: data })
                if (changed) hasSaveableChange = true
              }
            }

            return hasSaveableChange
          }
            

          form.addEventListener("change", async (ev) => {
            const { detail: valid } = ev
            if (valid) {
              const saveable = updateProtocolsWithNewFormData(form.data)
              if (saveable) await setSaveSettingsState(true)
            }
          })

          if (form.submitButton) form.addEventListener("submit", async () => {
            const saveable = updateProtocolsWithNewFormData(form.data)
            if (saveable)await setSaveSettingsState(true)
            modal.close()
          })

          const header = document.createElement('header')
          Object.assign(header.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' })
          const headerText = document.createElement('span')
          headerText.innerText = 'Plugin Settings'
          const closeButton = document.createElement('button')
          closeButton.innerText = 'Close'
          closeButton.onclick = () => modal.close()
          header.append(headerText, closeButton)

          const modal = createModal({ 
            header, 
            content: form
          })

          document.body.append(modal)
          modal.showModal()

          modal.addEventListener('close', () => {
            modal.remove()
            this.open = false
          })

          this.open = true

      }
    }
  },


  saveSettings: {
    save: {
      label: "Save Changes",
      async onClick() {
        const { settings } = await READY
        const protocol = neurosys.get()
        const copied = protocol.export()
        settings.set(SETTINGS_FILE_PREFIX, copied) // Only a single settings file is stored
        setSaveSettingsState(false)
      }
    }
  },

  outputs: {

    // Applied to all items
    type: 'checkbox',
    onClick: setOutputState,

    // Specific items
    items: []
  },

  evaluations: {
    type: 'radio',
    onClick: setEvaluationState,
    items: []
  }

}

const loadProtocolSettings = async (
  protocol: any, 
  states: any
) => {

  const { output, evaluation } = neurosys.plugins

  for (const id in output) {
    const plugin = output[id]
    const settings = protocol.outputs.get(id) ?? {}
    const { enabled } = settings
    const item = { id, label: plugin.label, checked: enabled }
    states.outputs.items.push(item)
    await setOutputState({ ...settings, id }) // Set the initial state
  }

  for (const id in evaluation) {
    const plugin = evaluation[id]
    const settings = protocol.evaluations.get(id) ?? {}
    const { enabled } = settings
    const item = { id, label: plugin.label, checked: enabled }
    states.evaluations.items.push(item)
    await setEvaluationState({ ...settings, id }) // Set the initial state
  }

}

READY.then(async (PLUGINS) => {

  const { menu, settings } = PLUGINS

  console.log(`Commoners loaded in ${performance.now() - loadStart}ms`)

  neurosys.register(PLUGINS)
  console.log(`Main plugins loaded in ${performance.now() - loadStart}ms`)

  // Register all service plugins
  // NOTE: Declaring this after the main plugins ensures that the main plugins are loaded with priority
  const urlsByService = Object.entries(SERVICES).reduce((acc, [key, value]) => ({ ...acc, [key]: value.url }), {})
  const servicePlugins = await getAllServerSidePlugins(urlsByService)
  for (const serviceName in servicePlugins) {
    const plugins = servicePlugins[serviceName]
    neurosys.register(plugins)
  }

  console.log(`Service plugins loaded in ${performance.now() - loadStart}ms`)

  const currentSettings = settings.get(SETTINGS_FILE_PREFIX) // Load settings from the file
  const protocol = await neurosys.load(currentSettings) // Load settings into the system

  // ------------------- Load Protocol Settings into Menu States -------------------
  await loadProtocolSettings(protocol, MENU_STATES)

  for (const [ key, states ] of Object.entries(MENU_STATES)) {
    const { items, ...rest } = states

    // NOTE: Setting items at once to avoid out-of-date updates
    if (items) menu.setItems(key, items.map((item) => ({ ...rest, ...item }))) // Apply the rest as defaults
    // if (items) items.forEach((item) => menu.setItem(key, { ...rest, ...item })) // Apply the rest as defaults

    // Add the first state of each menu option
    else menu.set(key, Object.values(states)[0])
  }

  // --------------------- Run Protocol ---------------------
  setInterval(calculate, UPDATE_INVERVAL)


})

// -------------------- Electron Menu Callbacks --------------------
READY.then(async (PLUGINS) => {
  const { bluetooth, serial } = PLUGINS
  if (bluetooth) devices.enableBluetooth(bluetooth)
  if (serial) devices.enableSerial(serial)
})

devices.setDeviceDiscoveryHandler(async (onSelect) => {

  let device = '';

  const onModalClosed = () => {
    onSelect(device)
    modal.remove()
  }

  const list = new DeviceDiscoveryList({
    emptyMessage: 'Searching...',
    onSelect: (deviceId) => {
      device = deviceId
      modal.close()
    }
  })

  const modal = createModal({ header: 'Discovered Devices', content: list })
  document.body.append(modal)
  modal.showModal()

  modal.addEventListener('close', onModalClosed)


  return (devices) => list.devices = devices

})