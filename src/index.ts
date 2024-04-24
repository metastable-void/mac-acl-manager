
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connect from 'connect-sqlite3';
import * as crypto from 'node:crypto';
import bodyParser from 'body-parser';
import * as fs from 'fs';

const generateRandomToken = () => {
    const buffer = crypto.randomBytes(32);
    return buffer.toString('hex');
};

function isError(error: any): error is NodeJS.ErrnoException {
    return error instanceof Error;
}

interface Device {
    name: string;
}

type MacAcl = {
    [macaddress: string]: Device;
};

class MacAclStore {
    public readonly jsonPath: string;

    public constructor(jsonPath: string) {
        this.jsonPath = jsonPath;
    }

    public async get(): Promise<MacAcl> {
        try {
            const data = await fs.promises.readFile(this.jsonPath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            if (isError(e) && e.code === 'ENOENT') {
                return {};
            }
            throw e;
        }
    }

    private async set(macAcl: MacAcl): Promise<void> {
        const tmpPath = this.jsonPath + generateRandomToken();
        const handle = await fs.promises.open(tmpPath, 'w');
        handle.write(JSON.stringify(macAcl, null, 2));
        handle.close();
        await fs.promises.rename(tmpPath, this.jsonPath);
    }

    public async add(macAddress: string, device: Device): Promise<void> {
        const lockDir = this.jsonPath + '.lock';
        await fs.promises.mkdir(lockDir, { recursive: false });
        try {
            const macAcl = await this.get();
            macAcl[macAddress] = device;
            await this.set(macAcl);
        } finally {
            await fs.promises.rmdir(lockDir);
        }
    }

    public async remove(macAddress: string): Promise<void> {
        const lockDir = this.jsonPath + '.lock';
        await fs.promises.mkdir(lockDir, { recursive: false });
        try {
            const macAcl = await this.get();
            delete macAcl[macAddress];
            await this.set(macAcl);
        } finally {
            await fs.promises.rmdir(lockDir);
        }
    }
}

declare module 'express-session' {
    interface SessionData {
        loggedIn: boolean;
    }
}

const app = express();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = parseInt(process.env.PORT || '3021', 10);
const SECRET = process.env.SECRET || generateRandomToken();

const SQLiteStore = connect(session);

const aclStore = new MacAclStore('mac_acl.json');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    store: new SQLiteStore() as any,
    secret: SECRET,
    resave: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  })
);

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session!.loggedIn = true;
        res.redirect('/admin/');
    } else {
        res.redirect('/');
    }
});

app.get('/logout', (req, res) => {
    req.session!.loggedIn = false;
    res.redirect('/');
});

app.get('/api/acl', async (req, res) => {
    if (!req.session!.loggedIn) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const macAcl = await aclStore.get();
    res.header('Cache-Control', 'no-store');
    res.json(macAcl);
});

app.post('/api/acl/add', async (req, res) => {
    if (!req.session!.loggedIn) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const { macAddress, deviceName } = req.body;
    await aclStore.add(macAddress, { name: deviceName });
    res.json({ success: true });
});

app.post('/api/acl/remove', async (req, res) => {
    if (!req.session!.loggedIn) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const { macAddress } = req.body;
    await aclStore.remove(macAddress);
    res.json({ success: true });
});

app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
