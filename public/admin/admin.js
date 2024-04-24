
function normalizeMacAddress(mac) {
    mac = mac.replace(/[^0-9A-Fa-f]/g, '');
    mac = mac.toLowerCase();
    if (mac.length != 12) {
        return null;
    }
    mac = mac.match(/.{2}/g).join('-');
    return mac;
}

const addMacFormInputMac = document.getElementById('add-mac-form-input-mac');
const addMacFormInputDeviceName = document.getElementById('add-mac-form-input-device-name');

const addMacFormButtonAdd = document.getElementById('add-mac-form-button-add');

function addMacAddress() {
    const mac = normalizeMacAddress(addMacFormInputMac.value);
    const deviceName = addMacFormInputDeviceName.value.trim();

    if (!mac) {
        alert('Invalid MAC address');
        return;
    }

    if (deviceName.length == 0) {
        alert('Device name cannot be empty');
        return;
    }

    const params = new URLSearchParams();
    params.append('macAddress', mac);
    params.append('deviceName', deviceName);
    fetch('/api/acl/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            //alert('MAC address added');
            addMacFormInputMac.value = '';
            addMacFormInputDeviceName.value = '';
            refresh();
        }
    });
}

function refresh() {
    fetch('/api/acl')
    .then(response => response.json())
    .then(data => {
        const macTableTbody = document.getElementById('mac-acl-table');
        macTableTbody.innerHTML = '';
        for (const mac in data) {
            const deviceName = data[mac].name;
            const tr = document.createElement('tr');
            const tdMac = document.createElement('td');
            const tdDeviceName = document.createElement('td');
            const tdDelete = document.createElement('td');
            tdMac.innerText = mac;
            tdDeviceName.innerText = deviceName;
            const deleteButton = document.createElement('button');
            deleteButton.innerText = 'Delete';
            deleteButton.onclick = () => {
                const params = new URLSearchParams();
                params.append('macAddress', mac);
                fetch(`/api/acl/remove`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params,
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                    } else {
                        //alert('MAC address deleted');
                        refresh();
                    }
                });
            };
            tdDelete.appendChild(deleteButton);
            tr.appendChild(tdMac);
            tr.appendChild(tdDeviceName);
            tr.appendChild(tdDelete);
            macTableTbody.appendChild(tr);
        }
    });
}

refresh();

addMacFormButtonAdd.onclick = addMacAddress;
