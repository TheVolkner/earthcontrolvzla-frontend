import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface AffectedZone {
  id: number;
  stateName?: string;
  municipalityName?: string;
  parishName?: string;
  name: string;
  description?: string;
  sourceSummary?: string;
  sourceUrl?: string;
  confidenceLevel?: string;
  locationPrecision?: string;
  center: GeoPoint;
  radiusMeters: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  operationalStatus: string;
  verificationStatus: string;
  distanceMeters?: number;
  lastReportedAt?: string;
}

export interface Structure {
  id: number;
  affectedZoneId?: number;
  affectedZoneName?: string;
  stateName?: string;
  municipalityName?: string;
  parishName?: string;
  name: string;
  structureType: string;
  addressText?: string;
  referenceText?: string;
  sourceSummary?: string;
  sourceUrl?: string;
  confidenceLevel?: string;
  locationPrecision?: string;
  location: GeoPoint;
  currentDamageLevel: string;
  currentSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  currentOperationalStatus: string;
  verificationStatus: string;
  reportedOn?: string;
  professionalInspectionReceived?: boolean;
  evacuated?: boolean;
  displacedPeopleReported?: boolean;
  distanceMeters?: number;
}

export interface StructureCreateRequest {
  affectedZoneId?: number | null;
  stateId?: string | null;
  municipalityId?: string | null;
  parishId?: string | null;
  name: string;
  structureType: string;
  addressText?: string | null;
  referenceText?: string | null;
  location: GeoPoint;
  currentDamageLevel?: string | null;
  currentSeverity?: string | null;
  currentOperationalStatus?: string | null;
  verificationStatus?: string | null;
  publicVisible?: boolean | null;
}

export interface ReliefCenter {
  id: number;
  stateName?: string;
  municipalityName?: string;
  parishName?: string;
  name: string;
  description?: string;
  centerType: string;
  status: string;
  reportedOn?: string;
  location?: GeoPoint | null;
  serviceRadiusMeters: number;
  addressText?: string;
  contactName?: string;
  contactPhone?: string;
  contactNotes?: string;
  sourceSummary?: string;
  sourceUrl?: string;
  confidenceLevel?: string;
  locationPrecision?: string;
  acceptsPeople: boolean;
  acceptsAnimals: boolean;
  acceptsDonations: boolean;
  international?: boolean;
  countryName?: string;
  internationalAddressText?: string;
  distanceMeters?: number;
  lastVerifiedAt?: string;
}

export interface ReliefCenterCreateRequest {
  stateId?: string | null;
  municipalityId?: string | null;
  parishId?: string | null;
  name: string;
  description?: string | null;
  centerType: string;
  location?: GeoPoint | null;
  addressText?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactNotes?: string | null;
  acceptsPeople?: boolean | null;
  acceptsAnimals?: boolean | null;
  acceptsDonations?: boolean | null;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
  publicVisible?: boolean | null;
  international?: boolean | null;
  countryName?: string | null;
  internationalAddressText?: string | null;
  photos?: TechnicalFilePhotoDraft[] | null;
}

export interface SeismicEvent {
  id: number;
  externalSource?: string;
  externalEventId?: string;
  name: string;
  description?: string;
  place?: string;
  eventTime: string;
  magnitude?: number;
  depthKm?: number;
  epicenter?: GeoPoint;
  sourceName?: string;
  sourceUrl?: string;
  eventUrl?: string;
  eventType?: string;
  feltReports?: number;
  mmi?: number;
  alertLevel?: string;
  tsunamiAlert?: boolean;
  status: string;
}

export interface EmergencyContact {
  id: number;
  serviceName: string;
  contactValue: string;
  contactType: string;
  scope: string;
  stateName?: string;
  notes?: string;
  confidenceLevel?: string;
}

export interface ContactSuggestionRequest {
  senderName?: string | null;
  senderEmail?: string | null;
  messageBody: string;
}

export interface ContactSuggestionResponse {
  id: number;
  recipientEmail: string;
  emailSubject: string;
  deliveryStatus: string;
  createdAt: string;
}

export interface AttachmentSummary {
  id: number;
  fileUrl: string;
  fileType: string;
  caption?: string;
  createdAt?: string;
}

export interface TechnicalFilePhotoDraft {
  fileName: string;
  fileType: string;
  dataUrl: string;
  caption?: string | null;
}

export interface SupplyNeedSummary {
  id: number;
  itemName: string;
  category: string;
  urgency: string;
  requestedQuantity?: number;
  fulfilledQuantity?: number;
  unit?: string;
  status: string;
  notes?: string;
}

export interface TechnicalFile {
  entityType: 'STRUCTURE' | 'RELIEF_CENTER' | string;
  structure?: Structure;
  reliefCenter?: ReliefCenter;
  photos: AttachmentSummary[];
  supplyNeeds: SupplyNeedSummary[];
}

export interface SupplyNeedCreateRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  itemName: string;
  category?: string | null;
  urgency?: string | null;
  requestedQuantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}

export interface SupplyNeedUpdateRequest {
  itemName: string;
  category?: string | null;
  urgency?: string | null;
  requestedQuantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}

export interface TechnicalFilePhotoChangeRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  fileName: string;
  fileType: string;
  dataUrl: string;
  caption?: string | null;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
}

export interface TechnicalFileSupplyNeedChangeRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  itemName: string;
  category?: string | null;
  urgency?: string | null;
  requestedQuantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
}

export interface TechnicalFileSupplyNeedUpdateChangeRequest extends SupplyNeedUpdateRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  supplyNeedId: number;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
}

export interface TechnicalFileSupplyNeedDeleteChangeRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  supplyNeedId: number;
  reason?: string | null;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
}

export interface TechnicalFileLocationChangeRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  location: GeoPoint;
  note?: string | null;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
}

export interface TechnicalFileDeleteChangeRequest {
  structureId?: number | null;
  reliefCenterId?: number | null;
  reason?: string | null;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
}

export interface TechnicalFileChange {
  id: number;
  structureId?: number | null;
  structureName?: string | null;
  reliefCenterId?: number | null;
  reliefCenterName?: string | null;
  changeType: 'PHOTO' | 'SUPPLY_NEED' | 'LOCATION' | 'DELETE' | string;
  status: string;
  proposedPayload: Record<string, unknown>;
  submitterDisplayName?: string | null;
  submitterContact?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  moderationNotes?: string | null;
}

export interface TechnicalFileChangeReviewRequest {
  approved: boolean;
  moderationNotes?: string | null;
}

export interface PublicIntakeReportRequest {
  reporterDisplayName?: string | null;
  reporterContact?: string | null;
  structureName?: string | null;
  addressText?: string | null;
  location: GeoPoint;
  accuracyMeters?: number | null;
  description: string;
  professionalInspectionReceived?: boolean | null;
  evacuated?: boolean | null;
  displacedPeopleReported?: boolean | null;
  supplyNeeds?: string[] | null;
  photos?: TechnicalFilePhotoDraft[] | null;
}

export interface PublicIntakeReport {
  id: number;
  structureName?: string;
  location: GeoPoint;
  description: string;
  photos?: TechnicalFilePhotoDraft[];
  status: string;
  submittedAt: string;
}

export interface BasicAuthCredentials {
  username: string;
  password?: string;
  token?: string;
  expiresAt?: string;
}

export interface CurrentUser {
  username: string;
  fullName: string;
  email: string;
  roles: string[];
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: CurrentUser;
}

export interface UserRegistrationRequest {
  username: string;
  password: string;
  email: string;
  fullName: string;
}

export interface UserRegistration {
  id: number;
  username: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
  approvedAt?: string | null;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
}

export interface BackofficeIntakeReport {
  id: number;
  assignedReliefCenterId?: number;
  assignedReliefCenterName?: string;
  convertedDamageReportId?: number;
  stateName?: string;
  municipalityName?: string;
  parishName?: string;
  reporterDisplayName?: string;
  reporterContact?: string;
  structureName?: string;
  location: GeoPoint;
  accuracyMeters?: number;
  description: string;
  photoCount?: number;
  status: string;
  moderationNotes?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface IntakeReportReviewRequest {
  assignedReliefCenterId?: number | null;
  status: 'RECEIVED' | 'ASSIGNED' | 'IN_REVIEW' | 'REJECTED' | 'DUPLICATE' | string;
  moderationNotes?: string | null;
}

export interface IntakeReportConvertRequest {
  affectedZoneId?: number | null;
  structureId?: number | null;
  assignedReliefCenterId?: number | null;
  sourceType?: string | null;
  location?: GeoPoint | null;
  accuracyMeters?: number | null;
  damageLevel?: string | null;
  severity?: string | null;
  operationalStatus?: string | null;
  verificationStatus?: string | null;
  survivorStatus?: string | null;
  assistanceStatus?: string | null;
  description?: string | null;
  moderatorNotes?: string | null;
  publicVisible?: boolean | null;
}

export interface StructureStatusUpdateRequest {
  currentDamageLevel?: string | null;
  currentSeverity?: string | null;
  currentOperationalStatus?: string | null;
  verificationStatus?: string | null;
  professionalInspectionReceived?: boolean | null;
  evacuated?: boolean | null;
  displacedPeopleReported?: boolean | null;
  publicVisible?: boolean | null;
  reason?: string | null;
}

export interface StructureDescriptionUpdateRequest {
  referenceText: string;
  reason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class EarthControlApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  findAffectedZones(point?: GeoPoint, radiusMeters = 5000, limit = 50): Observable<AffectedZone[]> {
    let params = new HttpParams().set('radiusMeters', radiusMeters).set('limit', limit);
    if (point) {
      params = params.set('longitude', point.longitude).set('latitude', point.latitude);
    }

    return this.http.get<AffectedZone[]>(`${this.baseUrl}/api/public/affected-zones`, { params });
  }

  findNearbyStructures(point: GeoPoint, radiusMeters = 1500, limit = 50): Observable<Structure[]> {
    const params = new HttpParams()
      .set('longitude', point.longitude)
      .set('latitude', point.latitude)
      .set('radiusMeters', radiusMeters)
      .set('limit', limit);

    return this.http.get<Structure[]>(`${this.baseUrl}/api/public/structures/nearby`, { params });
  }

  findReliefCenters(
    point?: GeoPoint,
    radiusMeters = 10000,
    limit = 50,
    filters: { centerType?: string; acceptsPeople?: boolean; acceptsAnimals?: boolean; acceptsDonations?: boolean; international?: boolean } = {},
  ): Observable<ReliefCenter[]> {
    let params = new HttpParams().set('radiusMeters', radiusMeters).set('limit', limit);
    if (point) {
      params = params.set('longitude', point.longitude).set('latitude', point.latitude);
    }
    if (filters.centerType) {
      params = params.set('centerType', filters.centerType);
    }
    if (filters.acceptsPeople !== undefined) {
      params = params.set('acceptsPeople', filters.acceptsPeople);
    }
    if (filters.acceptsAnimals !== undefined) {
      params = params.set('acceptsAnimals', filters.acceptsAnimals);
    }
    if (filters.acceptsDonations !== undefined) {
      params = params.set('acceptsDonations', filters.acceptsDonations);
    }
    if (filters.international !== undefined) {
      params = params.set('international', filters.international);
    }

    return this.http.get<ReliefCenter[]>(`${this.baseUrl}/api/public/relief-centers`, { params });
  }

  findSeismicEvents(from = '2026-06-24T00:00:00', minMagnitude = 2.5, limit = 100): Observable<SeismicEvent[]> {
    const params = new HttpParams()
      .set('from', from)
      .set('minMagnitude', minMagnitude)
      .set('limit', limit);

    return this.http.get<SeismicEvent[]>(`${this.baseUrl}/api/public/seismic-events`, { params });
  }

  findEmergencyContacts(limit = 100): Observable<EmergencyContact[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<EmergencyContact[]>(`${this.baseUrl}/api/public/emergency-contacts`, { params });
  }

  findStructureTechnicalFile(id: number): Observable<TechnicalFile> {
    return this.http.get<TechnicalFile>(`${this.baseUrl}/api/public/structures/${id}/technical-file`);
  }

  findReliefCenterTechnicalFile(id: number): Observable<TechnicalFile> {
    return this.http.get<TechnicalFile>(`${this.baseUrl}/api/public/relief-centers/${id}/technical-file`);
  }

  submitIntakeReport(payload: PublicIntakeReportRequest): Observable<PublicIntakeReport> {
    return this.http.post<PublicIntakeReport>(`${this.baseUrl}/api/public/intake-reports`, payload);
  }

  submitTechnicalFilePhotoChange(payload: TechnicalFilePhotoChangeRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/photos`, payload);
  }

  submitTechnicalFileSupplyNeedChange(payload: TechnicalFileSupplyNeedChangeRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/supply-needs`, payload);
  }

  submitTechnicalFileSupplyNeedUpdateChange(payload: TechnicalFileSupplyNeedUpdateChangeRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/supply-needs/updates`, payload);
  }

  submitTechnicalFileSupplyNeedDeleteChange(payload: TechnicalFileSupplyNeedDeleteChangeRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/supply-needs/deletions`, payload);
  }

  submitTechnicalFileLocationChange(payload: TechnicalFileLocationChangeRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/locations`, payload);
  }

  submitTechnicalFileDeleteChange(payload: TechnicalFileDeleteChangeRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/deletions`, payload);
  }

  submitReliefCenterCreateChange(payload: ReliefCenterCreateRequest): Observable<TechnicalFileChange> {
    return this.http.post<TechnicalFileChange>(`${this.baseUrl}/api/public/technical-file-changes/relief-centers`, payload);
  }

  submitContactSuggestion(payload: ContactSuggestionRequest): Observable<ContactSuggestionResponse> {
    return this.http.post<ContactSuggestionResponse>(`${this.baseUrl}/api/public/contact-suggestions`, payload);
  }

  registerUser(payload: UserRegistrationRequest): Observable<UserRegistration> {
    return this.http.post<UserRegistration>(`${this.baseUrl}/api/public/user-registrations`, payload);
  }

  checkUsernameAvailability(username: string): Observable<UsernameAvailability> {
    const params = new HttpParams().set('username', username);
    return this.http.get<UsernameAvailability>(`${this.baseUrl}/api/public/user-registrations/availability`, { params });
  }

  login(payload: AuthLoginRequest): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(`${this.baseUrl}/api/auth/login`, payload);
  }

  findCurrentUser(credentials: BasicAuthCredentials): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.baseUrl}/api/backoffice/account/me`, {
      headers: this.authHeaders(credentials),
    });
  }

  findBackofficeIntakeReports(
    status: string | null,
    limit: number,
    credentials: BasicAuthCredentials,
  ): Observable<BackofficeIntakeReport[]> {
    let params = new HttpParams().set('limit', limit);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<BackofficeIntakeReport[]>(`${this.baseUrl}/api/backoffice/intake-reports`, {
      params,
      headers: this.authHeaders(credentials),
    });
  }

  reviewIntakeReport(
    id: number,
    payload: IntakeReportReviewRequest,
    credentials: BasicAuthCredentials,
  ): Observable<BackofficeIntakeReport> {
    return this.http.patch<BackofficeIntakeReport>(`${this.baseUrl}/api/backoffice/intake-reports/${id}/review`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  convertIntakeReport(
    id: number,
    payload: IntakeReportConvertRequest,
    credentials: BasicAuthCredentials,
  ): Observable<BackofficeIntakeReport> {
    return this.http.post<BackofficeIntakeReport>(`${this.baseUrl}/api/backoffice/intake-reports/${id}/convert`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  updateStructureStatus(
    id: number,
    payload: StructureStatusUpdateRequest,
    credentials: BasicAuthCredentials,
  ): Observable<Structure> {
    return this.http.patch<Structure>(`${this.baseUrl}/api/backoffice/structures/${id}/status`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  createStructure(
    payload: StructureCreateRequest,
    credentials: BasicAuthCredentials,
  ): Observable<Structure> {
    return this.http.post<Structure>(`${this.baseUrl}/api/backoffice/structures`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  updateStructureDescription(
    id: number,
    payload: StructureDescriptionUpdateRequest,
    credentials: BasicAuthCredentials,
  ): Observable<Structure> {
    return this.http.patch<Structure>(`${this.baseUrl}/api/backoffice/structures/${id}/description`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  createReliefCenter(
    payload: ReliefCenterCreateRequest,
    credentials: BasicAuthCredentials,
  ): Observable<ReliefCenter> {
    return this.http.post<ReliefCenter>(`${this.baseUrl}/api/backoffice/relief-centers`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  findBackofficeTechnicalFileChanges(
    status: string,
    limit: number,
    credentials: BasicAuthCredentials,
  ): Observable<TechnicalFileChange[]> {
    const params = new HttpParams().set('status', status).set('limit', limit);
    return this.http.get<TechnicalFileChange[]>(`${this.baseUrl}/api/backoffice/technical-file-changes`, {
      params,
      headers: this.authHeaders(credentials),
    });
  }

  reviewTechnicalFileChange(
    id: number,
    payload: TechnicalFileChangeReviewRequest,
    credentials: BasicAuthCredentials,
  ): Observable<TechnicalFileChange> {
    return this.http.patch<TechnicalFileChange>(`${this.baseUrl}/api/backoffice/technical-file-changes/${id}/review`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  createSupplyNeed(
    payload: SupplyNeedCreateRequest,
    credentials: BasicAuthCredentials,
  ): Observable<SupplyNeedSummary> {
    return this.http.post<SupplyNeedSummary>(`${this.baseUrl}/api/backoffice/supply-needs`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  updateSupplyNeed(
    id: number,
    payload: SupplyNeedUpdateRequest,
    credentials: BasicAuthCredentials,
  ): Observable<SupplyNeedSummary> {
    return this.http.patch<SupplyNeedSummary>(`${this.baseUrl}/api/backoffice/supply-needs/${id}`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  deleteSupplyNeed(id: number, credentials: BasicAuthCredentials): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/backoffice/supply-needs/${id}`, {
      headers: this.authHeaders(credentials),
    });
  }

  publishTechnicalFilePhoto(
    payload: TechnicalFilePhotoChangeRequest,
    credentials: BasicAuthCredentials,
  ): Observable<TechnicalFile> {
    return this.http.post<TechnicalFile>(`${this.baseUrl}/api/backoffice/technical-file-changes/photos`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  updateTechnicalFileLocation(
    payload: TechnicalFileLocationChangeRequest,
    credentials: BasicAuthCredentials,
  ): Observable<TechnicalFile> {
    return this.http.post<TechnicalFile>(`${this.baseUrl}/api/backoffice/technical-file-changes/locations`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  deleteTechnicalFile(
    payload: TechnicalFileDeleteChangeRequest,
    credentials: BasicAuthCredentials,
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/backoffice/technical-file-changes/deletions`, payload, {
      headers: this.authHeaders(credentials),
    });
  }

  findUserRegistrations(credentials: BasicAuthCredentials): Observable<UserRegistration[]> {
    return this.http.get<UserRegistration[]>(`${this.baseUrl}/api/backoffice/user-registrations`, {
      headers: this.authHeaders(credentials),
    });
  }

  reviewUserRegistration(
    id: number,
    approved: boolean,
    credentials: BasicAuthCredentials,
  ): Observable<UserRegistration> {
    return this.http.patch<UserRegistration>(`${this.baseUrl}/api/backoffice/user-registrations/${id}/review`, {
      approved,
    }, {
      headers: this.authHeaders(credentials),
    });
  }

  private authHeaders(credentials: BasicAuthCredentials): HttpHeaders {
    if (credentials.token) {
      return new HttpHeaders({
        Authorization: `Bearer ${credentials.token}`,
      });
    }
    return new HttpHeaders({
      Authorization: `Basic ${btoa(`${credentials.username}:${credentials.password ?? ''}`)}`,
    });
  }
}
