/**
 * JARVIS ULTIMATE - VoIP Call Analyzer
 * 
 * Analyzes WhatsApp call signaling for forensic metadata extraction.
 */

// ============================================
// Types
// ============================================

export interface CallSignaling {
    callId: string;
    timestamp: Date;
    type: 'offer' | 'answer' | 'terminate' | 'reject' | 'busy';
    from: string;
    to: string;
    mediaType: 'audio' | 'video';
    sdpOffer?: SDPInfo;
    deviceInfo?: DeviceInfo;
    networkInfo?: NetworkInfo;
}

export interface SDPInfo {
    version: number;
    sessionName: string;
    origin: {
        username: string;
        sessionId: string;
        version: number;
        networkType: string;
        addressType: string;
        address: string;
    };
    mediaDescriptions: MediaDescription[];
    iceCandidates: ICECandidate[];
    fingerprint?: string;
    srtpKey?: string;
}

export interface MediaDescription {
    type: 'audio' | 'video';
    port: number;
    protocol: string;
    codecs: string[];
    attributes: Record<string, string>;
}

export interface ICECandidate {
    foundation: string;
    component: number;
    protocol: 'udp' | 'tcp';
    priority: number;
    ip: string;
    port: number;
    type: 'host' | 'srflx' | 'prflx' | 'relay';
    relatedAddress?: string;
    relatedPort?: number;
}

export interface DeviceInfo {
    platform: string;
    model?: string;
    osVersion?: string;
    appVersion?: string;
    userAgent?: string;
}

export interface NetworkInfo {
    publicIPs: string[];
    privateIPs: string[];
    stunServer?: string;
    turnServer?: string;
    relayUsed: boolean;
}

export interface CallAnalysis {
    callId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    direction: 'incoming' | 'outgoing';
    peer: string;
    mediaType: 'audio' | 'video';
    devices: DeviceInfo[];
    networkInfo: NetworkInfo;
    wasAnswered: boolean;
    terminationReason?: string;
    forensicNotes: string[];
}

// ============================================
// VoIP Analyzer Class
// ============================================

export class VoIPAnalyzer {
    private activeCalls = new Map<string, Partial<CallAnalysis>>();
    private completedCalls: CallAnalysis[] = [];

    // ==========================================
    // Process Signaling Events
    // ==========================================

    processSignaling(signaling: CallSignaling): void {
        switch (signaling.type) {
            case 'offer':
                this.handleOffer(signaling);
                break;
            case 'answer':
                this.handleAnswer(signaling);
                break;
            case 'terminate':
                this.handleTerminate(signaling);
                break;
            case 'reject':
            case 'busy':
                this.handleReject(signaling);
                break;
        }
    }

    private handleOffer(signaling: CallSignaling): void {
        const analysis: Partial<CallAnalysis> = {
            callId: signaling.callId,
            startTime: signaling.timestamp,
            direction: 'incoming',
            peer: signaling.from,
            mediaType: signaling.mediaType,
            devices: signaling.deviceInfo ? [signaling.deviceInfo] : [],
            networkInfo: this.extractNetworkInfo(signaling),
            wasAnswered: false,
            forensicNotes: [],
        };

        // Extract IP addresses from ICE candidates
        if (signaling.sdpOffer?.iceCandidates) {
            const ips = this.extractIPsFromICE(signaling.sdpOffer.iceCandidates);
            if (ips.publicIPs.length > 0) {
                analysis.forensicNotes!.push(`Peer public IP detected: ${ips.publicIPs.join(', ')}`);
            }
        }

        this.activeCalls.set(signaling.callId, analysis);
    }

    private handleAnswer(signaling: CallSignaling): void {
        const call = this.activeCalls.get(signaling.callId);
        if (!call) return;

        call.wasAnswered = true;

        if (signaling.deviceInfo) {
            call.devices = [...(call.devices || []), signaling.deviceInfo];
            call.forensicNotes!.push(`Answered on device: ${signaling.deviceInfo.platform} ${signaling.deviceInfo.model || ''}`);
        }

        // Merge network info from answer
        const answerNetwork = this.extractNetworkInfo(signaling);
        if (answerNetwork.publicIPs.length > 0) {
            call.networkInfo!.publicIPs.push(...answerNetwork.publicIPs);
        }
    }

    private handleTerminate(signaling: CallSignaling): void {
        const call = this.activeCalls.get(signaling.callId);
        if (!call) return;

        call.endTime = signaling.timestamp;
        call.duration = (signaling.timestamp.getTime() - (call.startTime?.getTime() || 0)) / 1000;
        call.terminationReason = 'normal';

        this.completeCall(signaling.callId, call);
    }

    private handleReject(signaling: CallSignaling): void {
        const call = this.activeCalls.get(signaling.callId);
        if (!call) return;

        call.endTime = signaling.timestamp;
        call.duration = 0;
        call.wasAnswered = false;
        call.terminationReason = signaling.type;

        this.completeCall(signaling.callId, call);
    }

    private completeCall(callId: string, partial: Partial<CallAnalysis>): void {
        const complete: CallAnalysis = {
            callId,
            startTime: partial.startTime || new Date(),
            endTime: partial.endTime,
            duration: partial.duration,
            direction: partial.direction || 'incoming',
            peer: partial.peer || 'unknown',
            mediaType: partial.mediaType || 'audio',
            devices: partial.devices || [],
            networkInfo: partial.networkInfo || { publicIPs: [], privateIPs: [], relayUsed: false },
            wasAnswered: partial.wasAnswered || false,
            terminationReason: partial.terminationReason,
            forensicNotes: partial.forensicNotes || [],
        };

        this.completedCalls.push(complete);
        this.activeCalls.delete(callId);

        // Keep only last 1000 calls
        if (this.completedCalls.length > 1000) {
            this.completedCalls.shift();
        }
    }

    // ==========================================
    // Network Info Extraction
    // ==========================================

    private extractNetworkInfo(signaling: CallSignaling): NetworkInfo {
        const network: NetworkInfo = {
            publicIPs: [],
            privateIPs: [],
            relayUsed: false,
        };

        if (!signaling.sdpOffer?.iceCandidates) return network;

        for (const candidate of signaling.sdpOffer.iceCandidates) {
            if (this.isPrivateIP(candidate.ip)) {
                network.privateIPs.push(candidate.ip);
            } else {
                network.publicIPs.push(candidate.ip);
            }

            if (candidate.type === 'relay') {
                network.relayUsed = true;
                network.turnServer = candidate.ip;
            }

            if (candidate.type === 'srflx' && candidate.relatedAddress) {
                network.stunServer = candidate.relatedAddress;
            }
        }

        return network;
    }

    private extractIPsFromICE(candidates: ICECandidate[]): { publicIPs: string[]; privateIPs: string[] } {
        const result = { publicIPs: [] as string[], privateIPs: [] as string[] };

        for (const c of candidates) {
            if (this.isPrivateIP(c.ip)) {
                result.privateIPs.push(c.ip);
            } else {
                result.publicIPs.push(c.ip);
            }
        }

        return result;
    }

    private isPrivateIP(ip: string): boolean {
        // Check for RFC 1918 private addresses
        if (ip.startsWith('10.')) return true;
        if (ip.startsWith('192.168.')) return true;
        if (ip.startsWith('172.')) {
            const second = parseInt(ip.split('.')[1], 10);
            if (second >= 16 && second <= 31) return true;
        }
        if (ip.startsWith('127.')) return true;
        if (ip.startsWith('169.254.')) return true; // Link-local
        return false;
    }

    // ==========================================
    // SDP Parsing
    // ==========================================

    static parseSDP(sdpString: string): SDPInfo {
        const lines = sdpString.split('\r\n').filter(l => l.length > 0);
        const sdp: SDPInfo = {
            version: 0,
            sessionName: '',
            origin: {
                username: '-',
                sessionId: '',
                version: 0,
                networkType: 'IN',
                addressType: 'IP4',
                address: '0.0.0.0',
            },
            mediaDescriptions: [],
            iceCandidates: [],
        };

        let currentMedia: MediaDescription | null = null;

        for (const line of lines) {
            const type = line[0];
            const content = line.slice(2);

            switch (type) {
                case 'v':
                    sdp.version = parseInt(content, 10);
                    break;
                case 's':
                    sdp.sessionName = content;
                    break;
                case 'o': {
                    const parts = content.split(' ');
                    sdp.origin = {
                        username: parts[0],
                        sessionId: parts[1],
                        version: parseInt(parts[2], 10),
                        networkType: parts[3],
                        addressType: parts[4],
                        address: parts[5],
                    };
                    break;
                }
                case 'm': {
                    const parts = content.split(' ');
                    currentMedia = {
                        type: parts[0] as 'audio' | 'video',
                        port: parseInt(parts[1], 10),
                        protocol: parts[2],
                        codecs: parts.slice(3),
                        attributes: {},
                    };
                    sdp.mediaDescriptions.push(currentMedia);
                    break;
                }
                case 'a': {
                    if (content.startsWith('candidate:')) {
                        const candidate = this.parseICECandidate(content);
                        if (candidate) sdp.iceCandidates.push(candidate);
                    } else if (content.startsWith('fingerprint:')) {
                        sdp.fingerprint = content.split(' ')[1];
                    } else if (currentMedia) {
                        const [key, ...valueParts] = content.split(':');
                        currentMedia.attributes[key] = valueParts.join(':');
                    }
                    break;
                }
            }
        }

        return sdp;
    }

    static parseICECandidate(candidateLine: string): ICECandidate | null {
        // Format: candidate:foundation component protocol priority ip port typ type [raddr ip rport port]
        const match = candidateLine.match(
            /candidate:(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\d+)\s+typ\s+(\S+)(?:\s+raddr\s+(\S+)\s+rport\s+(\d+))?/
        );

        if (!match) return null;

        return {
            foundation: match[1],
            component: parseInt(match[2], 10),
            protocol: match[3].toLowerCase() as 'udp' | 'tcp',
            priority: parseInt(match[4], 10),
            ip: match[5],
            port: parseInt(match[6], 10),
            type: match[7] as ICECandidate['type'],
            relatedAddress: match[8],
            relatedPort: match[9] ? parseInt(match[9], 10) : undefined,
        };
    }

    // ==========================================
    // Data Access
    // ==========================================

    getActiveCalls(): Partial<CallAnalysis>[] {
        return Array.from(this.activeCalls.values());
    }

    getCompletedCalls(limit: number = 100): CallAnalysis[] {
        return this.completedCalls.slice(-limit);
    }

    getCallsByPeer(peer: string): CallAnalysis[] {
        return this.completedCalls.filter(c => c.peer === peer);
    }

    getIPsDiscovered(): string[] {
        const ips = new Set<string>();
        for (const call of this.completedCalls) {
            call.networkInfo.publicIPs.forEach(ip => ips.add(ip));
        }
        return Array.from(ips);
    }

    getStats(): {
        totalCalls: number;
        activeCalls: number;
        answeredRate: number;
        avgDuration: number;
        uniquePeers: number;
    } {
        const answered = this.completedCalls.filter(c => c.wasAnswered);
        const withDuration = answered.filter(c => c.duration);

        return {
            totalCalls: this.completedCalls.length,
            activeCalls: this.activeCalls.size,
            answeredRate: this.completedCalls.length > 0
                ? (answered.length / this.completedCalls.length) * 100
                : 0,
            avgDuration: withDuration.length > 0
                ? withDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / withDuration.length
                : 0,
            uniquePeers: new Set(this.completedCalls.map(c => c.peer)).size,
        };
    }
}
