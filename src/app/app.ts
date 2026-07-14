import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HostListener } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { forkJoin, Subscription } from 'rxjs';
import * as L from 'leaflet';
import {
  AffectedZone,
  BackofficeIntakeReport,
  BasicAuthCredentials,
  CurrentUser,
  EarthControlApi,
  EmergencyContact,
  GeoPoint,
  PublicIntakeReportRequest,
  ReliefCenter,
  ReliefCenterCreateRequest,
  SeismicEvent,
  StructureDescriptionUpdateRequest,
  StructureCreateRequest,
  StructureStatusUpdateRequest,
  Structure,
  SupplyNeedSummary,
  SupplyNeedUpdateRequest,
  TechnicalFileChange,
  TechnicalFile,
  TechnicalFilePhotoDraft,
  UserRegistration,
} from './core/earth-control-api';

type ModuleKey =
  | 'reporte'
  | 'sismos'
  | 'edificios'
  | 'mapas-dano'
  | 'centros-acopio'
  | 'refugios-personas'
  | 'refugios-animales'
  | 'numeros-emergencia'
  | 'mapa-cartografico'
  | 'terminos-uso'
  | 'contacto'
  | 'aprobar'
  | 'perfil';

type DrawerItemKey = ModuleKey | 'add-acopio' | 'add-refugio-personas' | 'add-refugio-animales';
type Language = 'es' | 'en';

interface DrawerItem {
  key: DrawerItemKey;
  label: string;
  icon: string;
  requiresAuth?: boolean;
}

interface SearchSuggestion {
  label: string;
  detail: string;
  point: GeoPoint;
  module: ModuleKey;
  structure?: Structure;
  reliefCenter?: ReliefCenter;
  referencePoint?: ReferencePoint;
}

interface ReferencePoint {
  label: string;
  detail: string;
  point: GeoPoint;
  icon: string;
}

type ModerationHistoryKind = 'reports' | 'users';

interface ModerationHistoryItem {
  id: number;
  title: string;
  status: string;
  detail: string;
  reviewedAt: string;
  actor: string;
}

interface MapPreview {
  kind: 'structure' | 'relief';
  title: string;
  subtitle: string;
  caption: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  structure?: Structure;
  reliefCenter?: ReliefCenter;
}

interface StoredSession {
  credentials: BasicAuthCredentials;
  user: CurrentUser;
}

interface SubmitConfirmationDialog {
  title: string;
  message: string;
  details: Array<{ label: string; value: string }>;
  confirmText?: string;
  cancelText?: string;
  eyebrow?: string;
  icon?: string;
  onConfirm: () => void;
}

type ReportForm = FormGroup<{
  addressText: FormControl<string>;
  structureName: FormControl<string>;
  description: FormControl<string>;
  professionalInspectionReceived: FormControl<boolean>;
  evacuated: FormControl<boolean>;
  displacedPeopleReported: FormControl<boolean>;
}>;

type AuthForm = FormGroup<{
  username: FormControl<string>;
  password: FormControl<string>;
}>;

type PasswordChangeForm = FormGroup<{
  currentPassword: FormControl<string>;
  password: FormControl<string>;
  repeatPassword: FormControl<string>;
}>;

type ContactForm = FormGroup<{
  senderName: FormControl<string>;
  senderEmail: FormControl<string>;
  messageBody: FormControl<string>;
}>;

type RegistrationForm = FormGroup<{
  username: FormControl<string>;
  password: FormControl<string>;
  repeatPassword: FormControl<string>;
  email: FormControl<string>;
  fullName: FormControl<string>;
}>;

type StructureEditForm = FormGroup<{
  currentDamageLevel: FormControl<string>;
  currentSeverity: FormControl<string>;
  currentOperationalStatus: FormControl<string>;
  verificationStatus: FormControl<string>;
  professionalInspectionReceived: FormControl<boolean>;
  evacuated: FormControl<boolean>;
  displacedPeopleReported: FormControl<boolean>;
  reason: FormControl<string>;
}>;

type StructureDescriptionForm = FormGroup<{
  referenceText: FormControl<string>;
  reason: FormControl<string>;
}>;

type ReliefCreateType = 'COLLECTION_CENTER' | 'SHELTER' | 'ANIMAL_SHELTER';
type DonationScope = 'national' | 'international';

type ReliefCreateForm = FormGroup<{
  name: FormControl<string>;
  addressText: FormControl<string>;
  countryName: FormControl<string>;
  internationalAddressText: FormControl<string>;
  contactPhone: FormControl<string>;
}>;

interface AppFeedbackDialogData {
  title: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon: string;
  eyebrow?: string;
  details?: Array<{ label: string; value: string }>;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-feedback-dialog',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <section class="app-feedback-dialog" [attr.data-tone]="data.tone">
      <div class="dialog-head">
        <mat-icon>{{ data.icon }}</mat-icon>
        <div>
          <p>{{ data.eyebrow || 'Validación' }}</p>
          <h2 mat-dialog-title>{{ data.title }}</h2>
        </div>
      </div>

      <mat-dialog-content>
        <p>{{ data.message }}</p>
        @if (data.details?.length) {
          <dl>
            @for (item of data.details; track item.label) {
              <div><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
            }
          </dl>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        @if (data.cancelText) {
          <button type="button" mat-stroked-button (click)="close(false)">{{ data.cancelText }}</button>
        }
        <button type="button" mat-flat-button (click)="close(true)">
          <mat-icon>{{ data.tone === 'success' ? 'check_circle' : 'done' }}</mat-icon>
          {{ data.confirmText || 'Aceptar' }}
        </button>
      </mat-dialog-actions>
    </section>
  `,
  styles: [`
    .app-feedback-dialog {
      display: block;
      min-width: min(380px, 84vw);
      color: #202124;
    }

    .dialog-head {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 0.75rem;
      align-items: center;
      padding: 1rem 1rem 0;
    }

    .dialog-head > mat-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      color: #174ea6;
      background: #e8f0fe;
    }

    .app-feedback-dialog[data-tone='success'] .dialog-head > mat-icon {
      color: #0d652d;
      background: #e6f4ea;
    }

    .app-feedback-dialog[data-tone='warning'] .dialog-head > mat-icon {
      color: #b06000;
      background: #fef7e0;
    }

    .app-feedback-dialog[data-tone='danger'] .dialog-head > mat-icon {
      color: #a50e0e;
      background: #fce8e6;
    }

    .dialog-head p {
      margin: 0 0 0.2rem;
      color: #5f6368;
      font-size: 0.76rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .dialog-head h2 {
      margin: 0;
      padding: 0;
      font-size: 1.08rem;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    mat-dialog-content {
      display: grid;
      gap: 0.75rem;
      padding-top: 0.75rem;
      color: #3c4043;
    }

    mat-dialog-content p {
      margin: 0;
      line-height: 1.45;
    }

    dl {
      display: grid;
      gap: 0.45rem;
      margin: 0;
    }

    dl div {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 0.5rem;
      padding: 0.45rem 0;
      border-top: 1px solid #edf0f2;
    }

    dt {
      color: #5f6368;
      font-size: 0.76rem;
      font-weight: 800;
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-weight: 700;
    }

    mat-dialog-actions {
      padding: 0.25rem 1rem 1rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class AppFeedbackDialog {
  protected readonly data = inject<AppFeedbackDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AppFeedbackDialog, boolean>);

  protected close(result: boolean): void {
    this.dialogRef.close(result);
  }
}

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('moduleScroller') private moduleScroller?: ElementRef<HTMLDivElement>;

  private readonly api = inject(EarthControlApi);
  private readonly dialog = inject(MatDialog);
  private readonly subscriptions = new Subscription();
  private readonly sessionStorageKey = 'earthcontrol.session.v1';
  private readonly mobileViewportQuery = '(max-width: 1180px), (pointer: coarse) and (max-width: 1368px)';
  private map?: L.Map;
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.TileLayer;
  private readonly zoneLayer = L.layerGroup();
  private readonly structureLayer = L.layerGroup();
  private readonly reliefLayer = L.layerGroup();
  private readonly seismicLayer = L.layerGroup();
  private readonly referenceLayer = L.layerGroup();
  private readonly positionLayer = L.layerGroup();
  private readonly referencePoints: ReferencePoint[] = [
    {
      label: 'Hospital Universitario de Caracas',
      detail: 'Hospital · Ciudad Universitaria · Distrito Capital',
      point: { latitude: 10.4906, longitude: -66.8919 },
      icon: 'local_hospital',
    },
    {
      label: 'Hospital Vargas de Caracas',
      detail: 'Hospital · San José · Distrito Capital',
      point: { latitude: 10.5107, longitude: -66.9147 },
      icon: 'local_hospital',
    },
    {
      label: 'Plaza Venezuela',
      detail: 'Referencia urbana · Caracas · Distrito Capital',
      point: { latitude: 10.5006, longitude: -66.8891 },
      icon: 'place',
    },
    {
      label: 'Parque Central',
      detail: 'Referencia urbana · Caracas · Distrito Capital',
      point: { latitude: 10.5012, longitude: -66.9006 },
      icon: 'place',
    },
    {
      label: 'Centro Comercial Sambil Caracas',
      detail: 'Centro comercial · Chacao · Miranda',
      point: { latitude: 10.4925, longitude: -66.8531 },
      icon: 'local_mall',
    },
    {
      label: 'Terminal La Bandera',
      detail: 'Terminal terrestre · Caracas · Distrito Capital',
      point: { latitude: 10.4779, longitude: -66.9363 },
      icon: 'directions_bus',
    },
    {
      label: 'Aeropuerto Internacional de Maiquetía',
      detail: 'Aeropuerto · Maiquetía · La Guaira',
      point: { latitude: 10.6031, longitude: -66.9912 },
      icon: 'flight',
    },
    {
      label: 'Hospital José María Vargas de La Guaira',
      detail: 'Hospital · La Guaira',
      point: { latitude: 10.6033, longitude: -66.9326 },
      icon: 'local_hospital',
    },
    {
      label: 'Plaza Bolívar de La Guaira',
      detail: 'Referencia histórica · La Guaira',
      point: { latitude: 10.6016, longitude: -66.9334 },
      icon: 'account_balance',
    },
    {
      label: 'Hospital Central de Maracay',
      detail: 'Hospital · Maracay · Aragua',
      point: { latitude: 10.2464, longitude: -67.5963 },
      icon: 'local_hospital',
    },
    {
      label: 'Plaza Bolívar de Maracay',
      detail: 'Referencia histórica · Maracay · Aragua',
      point: { latitude: 10.2469, longitude: -67.5961 },
      icon: 'account_balance',
    },
    {
      label: 'Centro Comercial Las Américas Maracay',
      detail: 'Centro comercial · Maracay · Aragua',
      point: { latitude: 10.2439, longitude: -67.6065 },
      icon: 'local_mall',
    },
    {
      label: 'Plaza Bolívar de La Victoria',
      detail: 'Referencia histórica · La Victoria · Aragua',
      point: { latitude: 10.2268, longitude: -67.3335 },
      icon: 'account_balance',
    },
    {
      label: 'Ciudad Hospitalaria Dr. Enrique Tejera',
      detail: 'Hospital · Valencia · Carabobo',
      point: { latitude: 10.1795, longitude: -68.0039 },
      icon: 'local_hospital',
    },
    {
      label: 'Plaza Bolívar de Valencia',
      detail: 'Referencia histórica · Valencia · Carabobo',
      point: { latitude: 10.1806, longitude: -68.0039 },
      icon: 'account_balance',
    },
    {
      label: 'Centro Comercial Sambil Valencia',
      detail: 'Centro comercial · Naguanagua · Carabobo',
      point: { latitude: 10.2225, longitude: -68.0101 },
      icon: 'local_mall',
    },
    {
      label: 'Hospital Dr. Adolfo Prince Lara',
      detail: 'Hospital · Puerto Cabello · Carabobo',
      point: { latitude: 10.4699, longitude: -68.0121 },
      icon: 'local_hospital',
    },
    {
      label: 'Plaza Bolívar de Puerto Cabello',
      detail: 'Referencia histórica · Puerto Cabello · Carabobo',
      point: { latitude: 10.4734, longitude: -68.0122 },
      icon: 'account_balance',
    },
  ];
  private readonly searchOnlyReferencePoints: ReferencePoint[] = [
    { label: 'Catia La Mar', detail: 'Sector urbano · La Guaira / Vargas', point: { latitude: 10.602, longitude: -67.03 }, icon: 'place' },
    { label: 'Playa Grande', detail: 'Sector costero · Urimare · La Guaira', point: { latitude: 10.599, longitude: -67.024 }, icon: 'beach_access' },
    { label: 'Urimare', detail: 'Parroquia · La Guaira / Vargas', point: { latitude: 10.596, longitude: -67.039 }, icon: 'place' },
    { label: 'Maiquetía', detail: 'Sector urbano · La Guaira / Vargas', point: { latitude: 10.596, longitude: -66.956 }, icon: 'place' },
    { label: 'Puerto de La Guaira', detail: 'Puerto · La Guaira centro', point: { latitude: 10.604, longitude: -66.935 }, icon: 'directions_boat' },
    { label: 'Macuto', detail: 'Sector costero · La Guaira / Vargas', point: { latitude: 10.606, longitude: -66.889 }, icon: 'beach_access' },
    { label: 'Camurí Chico', detail: 'Sector costero · La Guaira / Vargas', point: { latitude: 10.615, longitude: -66.861 }, icon: 'place' },
    { label: 'Caraballeda', detail: 'Sector urbano costero · La Guaira / Vargas', point: { latitude: 10.6167, longitude: -66.85 }, icon: 'place' },
    { label: 'Urbanización Caribe', detail: 'Caraballeda · La Guaira', point: { latitude: 10.616, longitude: -66.847 }, icon: 'apartment' },
    { label: 'Los Corales', detail: 'Urbanización · Caraballeda · La Guaira', point: { latitude: 10.617, longitude: -66.835 }, icon: 'apartment' },
    { label: 'Tanaguarena', detail: 'Sector costero · Caraballeda · La Guaira', point: { latitude: 10.613, longitude: -66.821 }, icon: 'place' },
    { label: 'Playa Los Cocos', detail: 'Playa · Caraballeda · La Guaira', point: { latitude: 10.619, longitude: -66.838 }, icon: 'beach_access' },
    { label: 'Avenida La Playa', detail: 'Vía local · Caraballeda · La Guaira', point: { latitude: 10.616, longitude: -66.843 }, icon: 'alt_route' },
    { label: 'Avenida Principal de Caribe', detail: 'Vía principal · Caraballeda · La Guaira', point: { latitude: 10.615, longitude: -66.853 }, icon: 'alt_route' },
    { label: 'Avenida Caraballeda Oeste', detail: 'Vía local · Caraballeda · La Guaira', point: { latitude: 10.617, longitude: -66.846 }, icon: 'alt_route' },
    { label: 'Mariana Mar', detail: 'Edificio visible en OSM · Avenida La Playa · Caraballeda', point: { latitude: 10.618611, longitude: -66.838611 }, icon: 'apartment' },
    { label: 'Mariana Grande', detail: 'Edificio visible en OSM · Los Corales · Caraballeda', point: { latitude: 10.618611, longitude: -66.837778 }, icon: 'apartment' },
    { label: 'Palma Real', detail: 'Residencias · Caraballeda · La Guaira', point: { latitude: 10.6176, longitude: -66.8365 }, icon: 'apartment' },
    { label: 'Flamingo Suites', detail: 'Edificio visible en OSM · Avenida La Playa · Caraballeda', point: { latitude: 10.617, longitude: -66.835 }, icon: 'apartment' },
    { label: 'Residencias Caribe', detail: 'Edificio visible en OSM · Caraballeda · La Guaira', point: { latitude: 10.6162, longitude: -66.8583 }, icon: 'apartment' },
    { label: 'OPPE 22 A B C D', detail: 'Conjunto residencial · Caraballeda · La Guaira', point: { latitude: 10.6165, longitude: -66.84 }, icon: 'apartment' },
    { label: 'OPPE 26', detail: 'Conjunto residencial · Caraballeda · La Guaira', point: { latitude: 10.616, longitude: -66.846 }, icon: 'apartment' },
    { label: 'OPPE 27 D', detail: 'Conjunto residencial · Avenida Principal de Caribe · La Guaira', point: { latitude: 10.6147, longitude: -66.845 }, icon: 'apartment' },
    { label: 'OPPE 33', detail: 'Conjunto residencial · Caraballeda · La Guaira', point: { latitude: 10.6138, longitude: -66.839 }, icon: 'apartment' },
    { label: 'OPPE 34 A', detail: 'Conjunto residencial · Avenida La Playa · La Guaira', point: { latitude: 10.615, longitude: -66.833 }, icon: 'apartment' },
    { label: 'Colegio Tanaguarena', detail: 'Colegio · Tanaguarena · La Guaira', point: { latitude: 10.613, longitude: -66.835 }, icon: 'school' },
    { label: 'E/S Tanaguarena', detail: 'Estación de servicio · Caraballeda · La Guaira', point: { latitude: 10.614, longitude: -66.848 }, icon: 'local_gas_station' },
    { label: 'Hotel Eduard\'s', detail: 'Hotel · Avenida Principal de Caribe · Caraballeda', point: { latitude: 10.6191, longitude: -66.8572 }, icon: 'hotel' },
    { label: 'Caraballeda Golf & Yacht Club', detail: 'Club · Caraballeda · La Guaira', point: { latitude: 10.6183, longitude: -66.8494 }, icon: 'golf_course' },
    { label: 'Naiguatá', detail: 'Sector costero · La Guaira / Vargas', point: { latitude: 10.606, longitude: -66.738 }, icon: 'beach_access' },
    { label: 'Los Caracas', detail: 'Sector costero · La Guaira / Vargas', point: { latitude: 10.55, longitude: -66.61 }, icon: 'beach_access' },
    { label: 'La Guaira Centro', detail: 'Centro urbano · La Guaira / Vargas', point: { latitude: 10.6016, longitude: -66.9334 }, icon: 'place' },
    { label: 'Punta de Mulatos', detail: 'Sector costero · La Guaira', point: { latitude: 10.608, longitude: -66.928 }, icon: 'beach_access' },
    { label: 'Plaza El Cónsul', detail: 'Referencia urbana · Maiquetía · La Guaira', point: { latitude: 10.596, longitude: -66.956 }, icon: 'place' },
    { label: '10 de Marzo', detail: 'Sector urbano · La Guaira / Vargas', point: { latitude: 10.596, longitude: -67.008 }, icon: 'place' },
    { label: 'Mare Abajo', detail: 'Sector urbano · La Guaira / Vargas', point: { latitude: 10.599, longitude: -66.995 }, icon: 'place' },
    { label: 'Carlos Soublette', detail: 'Parroquia · La Guaira / Vargas', point: { latitude: 10.597, longitude: -66.975 }, icon: 'place' },
    { label: 'Maiquetía Centro', detail: 'Centro urbano · La Guaira / Vargas', point: { latitude: 10.596, longitude: -66.956 }, icon: 'place' },
    { label: 'Terminal de Pasajeros Catia La Mar', detail: 'Terminal terrestre · La Guaira / Vargas', point: { latitude: 10.603, longitude: -67.03 }, icon: 'directions_bus' },
    { label: 'Avenida La Armada', detail: 'Eje vial · Catia La Mar · La Guaira', point: { latitude: 10.598, longitude: -67.026 }, icon: 'alt_route' },
    { label: 'Avenida Soublette', detail: 'Eje vial · La Guaira', point: { latitude: 10.602, longitude: -66.94 }, icon: 'alt_route' },
    { label: 'Avenida Intercomunal La Guaira', detail: 'Eje vial costero · Vargas', point: { latitude: 10.602, longitude: -66.91 }, icon: 'alt_route' },
    { label: 'Caribe Caraballeda', detail: 'Sector Caribe · Caraballeda · La Guaira', point: { latitude: 10.616, longitude: -66.853 }, icon: 'place' },
    { label: 'La Llanada', detail: 'Sector · Caraballeda / Macuto · La Guaira', point: { latitude: 10.6167, longitude: -66.85 }, icon: 'place' },
    { label: 'Palmar Este', detail: 'Sector residencial · Caraballeda · La Guaira', point: { latitude: 10.615, longitude: -66.84 }, icon: 'place' },
    { label: 'Camurí Grande', detail: 'Sector costero · La Guaira / Vargas', point: { latitude: 10.612, longitude: -66.833 }, icon: 'beach_access' },
    { label: 'Universidad Marítima del Caribe', detail: 'Universidad · Catia La Mar · La Guaira', point: { latitude: 10.603, longitude: -67.02 }, icon: 'school' },
    { label: 'Hospital José María Vargas de La Guaira', detail: 'Hospital · La Guaira', point: { latitude: 10.6033, longitude: -66.9326 }, icon: 'local_hospital' },
    { label: 'Catia', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.512, longitude: -66.942 }, icon: 'place' },
    { label: 'Propatria', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.512, longitude: -66.958 }, icon: 'place' },
    { label: '23 de Enero', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.507, longitude: -66.93 }, icon: 'place' },
    { label: 'San Bernardino', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.514, longitude: -66.901 }, icon: 'place' },
    { label: 'Sabana Grande', detail: 'Bulevar y sector comercial · Caracas', point: { latitude: 10.494, longitude: -66.877 }, icon: 'storefront' },
    { label: 'Los Chaguaramos', detail: 'Sector urbano · Caracas', point: { latitude: 10.486, longitude: -66.887 }, icon: 'place' },
    { label: 'Santa Mónica', detail: 'Sector urbano · Caracas', point: { latitude: 10.478, longitude: -66.883 }, icon: 'place' },
    { label: 'El Valle', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.465, longitude: -66.914 }, icon: 'place' },
    { label: 'Coche', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.444, longitude: -66.926 }, icon: 'place' },
    { label: 'Bello Monte', detail: 'Sector urbano · Caracas', point: { latitude: 10.487, longitude: -66.868 }, icon: 'place' },
    { label: 'La Pastora', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.513, longitude: -66.917 }, icon: 'place' },
    { label: 'Altagracia', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.508, longitude: -66.913 }, icon: 'place' },
    { label: 'La Candelaria Caracas', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.505, longitude: -66.902 }, icon: 'place' },
    { label: 'San José Caracas', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.51, longitude: -66.909 }, icon: 'place' },
    { label: 'San Agustín', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.497, longitude: -66.904 }, icon: 'place' },
    { label: 'El Recreo Caracas', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.492, longitude: -66.878 }, icon: 'place' },
    { label: 'La Florida Caracas', detail: 'Sector urbano · Caracas', point: { latitude: 10.506, longitude: -66.881 }, icon: 'place' },
    { label: 'El Paraíso', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.478, longitude: -66.923 }, icon: 'place' },
    { label: 'Montalbán', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.473, longitude: -66.946 }, icon: 'place' },
    { label: 'La Vega', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.469, longitude: -66.947 }, icon: 'place' },
    { label: 'Antímano', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.474, longitude: -66.971 }, icon: 'place' },
    { label: 'Caricuao', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.433, longitude: -66.987 }, icon: 'place' },
    { label: 'El Junquito', detail: 'Sector periurbano · Libertador · Caracas', point: { latitude: 10.466, longitude: -67.075 }, icon: 'place' },
    { label: 'Macarao', detail: 'Sector urbano · Libertador · Caracas', point: { latitude: 10.44, longitude: -67.04 }, icon: 'place' },
    { label: 'Ciudad Universitaria de Caracas', detail: 'Universidad · Distrito Capital', point: { latitude: 10.4906, longitude: -66.8919 }, icon: 'school' },
    { label: 'Parque Central Caracas', detail: 'Conjunto urbano · Distrito Capital', point: { latitude: 10.5012, longitude: -66.9006 }, icon: 'apartment' },
    { label: 'Bulevar de Sabana Grande', detail: 'Eje peatonal comercial · Caracas', point: { latitude: 10.494, longitude: -66.877 }, icon: 'storefront' },
    { label: 'C.C. Sambil Caracas', detail: 'Centro comercial · Chacao · Miranda', point: { latitude: 10.4925, longitude: -66.8531 }, icon: 'local_mall' },
    { label: 'C.C. San Ignacio', detail: 'Centro comercial · Chacao · Miranda', point: { latitude: 10.498, longitude: -66.853 }, icon: 'local_mall' },
    { label: 'C.C. Líder', detail: 'Centro comercial · La California · Miranda', point: { latitude: 10.485, longitude: -66.816 }, icon: 'local_mall' },
    { label: 'Altamira', detail: 'Sector urbano · Chacao · Miranda', point: { latitude: 10.497, longitude: -66.848 }, icon: 'place' },
    { label: 'Los Palos Grandes', detail: 'Sector urbano · Chacao · Miranda', point: { latitude: 10.5, longitude: -66.842 }, icon: 'place' },
    { label: 'La Castellana', detail: 'Sector urbano · Chacao · Miranda', point: { latitude: 10.501, longitude: -66.855 }, icon: 'place' },
    { label: 'Chacao', detail: 'Municipio y centro urbano · Miranda', point: { latitude: 10.493, longitude: -66.856 }, icon: 'place' },
    { label: 'Las Mercedes', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.484, longitude: -66.858 }, icon: 'storefront' },
    { label: 'Santa Fe', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.456, longitude: -66.855 }, icon: 'place' },
    { label: 'Prados del Este', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.448, longitude: -66.868 }, icon: 'place' },
    { label: 'Cumbres de Curumo', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.464, longitude: -66.888 }, icon: 'place' },
    { label: 'La California', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.485, longitude: -66.817 }, icon: 'place' },
    { label: 'Los Dos Caminos', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.492, longitude: -66.827 }, icon: 'place' },
    { label: 'La Urbina', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.493, longitude: -66.805 }, icon: 'place' },
    { label: 'Petare', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.476, longitude: -66.8 }, icon: 'place' },
    { label: 'Sebucán', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.505, longitude: -66.82 }, icon: 'place' },
    { label: 'El Cafetal', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.467, longitude: -66.828 }, icon: 'place' },
    { label: 'La Carlota', detail: 'Sector urbano · Miranda', point: { latitude: 10.489, longitude: -66.839 }, icon: 'place' },
    { label: 'Baruta', detail: 'Municipio · Miranda', point: { latitude: 10.432, longitude: -66.875 }, icon: 'place' },
    { label: 'El Hatillo', detail: 'Municipio · Miranda', point: { latitude: 10.424, longitude: -66.826 }, icon: 'place' },
    { label: 'Guarenas', detail: 'Ciudad · Miranda', point: { latitude: 10.466, longitude: -66.616 }, icon: 'place' },
    { label: 'Guatire', detail: 'Ciudad · Miranda', point: { latitude: 10.476, longitude: -66.542 }, icon: 'place' },
    { label: 'Los Teques', detail: 'Ciudad · Miranda', point: { latitude: 10.344, longitude: -67.044 }, icon: 'place' },
    { label: 'Carrizal', detail: 'Ciudad · Miranda', point: { latitude: 10.35, longitude: -66.986 }, icon: 'place' },
    { label: 'San Antonio de los Altos', detail: 'Ciudad · Miranda', point: { latitude: 10.388, longitude: -66.951 }, icon: 'place' },
    { label: 'Charallave', detail: 'Ciudad · Miranda', point: { latitude: 10.242, longitude: -66.857 }, icon: 'place' },
    { label: 'Cúa', detail: 'Ciudad · Miranda', point: { latitude: 10.162, longitude: -66.886 }, icon: 'place' },
    { label: 'Ocumare del Tuy', detail: 'Ciudad · Miranda', point: { latitude: 10.118, longitude: -66.776 }, icon: 'place' },
    { label: 'Santa Teresa del Tuy', detail: 'Ciudad · Miranda', point: { latitude: 10.235, longitude: -66.664 }, icon: 'place' },
    { label: 'Higuerote', detail: 'Ciudad costera · Miranda', point: { latitude: 10.481, longitude: -66.099 }, icon: 'beach_access' },
    { label: 'Río Chico', detail: 'Ciudad costera · Miranda', point: { latitude: 10.319, longitude: -65.984 }, icon: 'beach_access' },
    { label: 'Plaza Francia de Altamira', detail: 'Plaza · Chacao · Miranda', point: { latitude: 10.4965, longitude: -66.851 }, icon: 'account_balance' },
    { label: 'Plaza Los Palos Grandes', detail: 'Plaza · Chacao · Miranda', point: { latitude: 10.501, longitude: -66.842 }, icon: 'account_balance' },
    { label: 'Santa Eduvigis', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.501, longitude: -66.835 }, icon: 'place' },
    { label: 'Los Ruices', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.491, longitude: -66.82 }, icon: 'place' },
    { label: 'Boleíta', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.497, longitude: -66.813 }, icon: 'place' },
    { label: 'Palo Verde', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.481, longitude: -66.794 }, icon: 'place' },
    { label: 'La Dolorita', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.474, longitude: -66.767 }, icon: 'place' },
    { label: 'Caucagüita', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.48, longitude: -66.746 }, icon: 'place' },
    { label: 'Fila de Mariches', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.469, longitude: -66.72 }, icon: 'place' },
    { label: 'Terrazas del Ávila', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.505, longitude: -66.794 }, icon: 'place' },
    { label: 'Colinas de Bello Monte', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.486, longitude: -66.869 }, icon: 'place' },
    { label: 'Chuao', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.48, longitude: -66.841 }, icon: 'place' },
    { label: 'San Román', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.478, longitude: -66.853 }, icon: 'place' },
    { label: 'Los Naranjos', detail: 'Sector urbano · El Hatillo · Miranda', point: { latitude: 10.443, longitude: -66.839 }, icon: 'place' },
    { label: 'La Trinidad', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.438, longitude: -66.872 }, icon: 'place' },
    { label: 'El Marqués', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.499, longitude: -66.81 }, icon: 'place' },
    { label: 'El Llanito', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.474, longitude: -66.807 }, icon: 'place' },
    { label: 'Caurimare', detail: 'Sector urbano · Baruta · Miranda', point: { latitude: 10.469, longitude: -66.817 }, icon: 'place' },
    { label: 'Macaracuay', detail: 'Sector urbano · Sucre · Miranda', point: { latitude: 10.462, longitude: -66.807 }, icon: 'place' },
    { label: 'Plaza Bolívar de Los Teques', detail: 'Plaza · Los Teques · Miranda', point: { latitude: 10.344, longitude: -67.044 }, icon: 'account_balance' },
    { label: 'Terminal Los Lagos', detail: 'Terminal terrestre · Los Teques · Miranda', point: { latitude: 10.349, longitude: -67.039 }, icon: 'directions_bus' },
    { label: 'Centro Comercial La Cascada', detail: 'Centro comercial · Carrizal · Miranda', point: { latitude: 10.36, longitude: -66.994 }, icon: 'local_mall' },
    { label: 'Guarenas Centro', detail: 'Centro urbano · Miranda', point: { latitude: 10.466, longitude: -66.616 }, icon: 'place' },
    { label: 'Guatire Centro', detail: 'Centro urbano · Miranda', point: { latitude: 10.476, longitude: -66.542 }, icon: 'place' },
    { label: 'Maracay', detail: 'Ciudad · Aragua', point: { latitude: 10.246, longitude: -67.596 }, icon: 'place' },
    { label: 'Las Delicias', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.263, longitude: -67.594 }, icon: 'place' },
    { label: 'Caña de Azúcar', detail: 'Sector urbano · Mario Briceño Iragorry · Aragua', point: { latitude: 10.29, longitude: -67.632 }, icon: 'place' },
    { label: 'El Limón', detail: 'Sector urbano · Mario Briceño Iragorry · Aragua', point: { latitude: 10.305, longitude: -67.633 }, icon: 'place' },
    { label: 'Turmero', detail: 'Ciudad · Santiago Mariño · Aragua', point: { latitude: 10.228, longitude: -67.474 }, icon: 'place' },
    { label: 'Cagua', detail: 'Ciudad · Sucre · Aragua', point: { latitude: 10.186, longitude: -67.46 }, icon: 'place' },
    { label: 'La Victoria', detail: 'Ciudad · Ribas · Aragua', point: { latitude: 10.2268, longitude: -67.3335 }, icon: 'place' },
    { label: 'El Consejo', detail: 'Ciudad · Revenga · Aragua', point: { latitude: 10.237, longitude: -67.267 }, icon: 'place' },
    { label: 'San Mateo', detail: 'Ciudad · Bolívar · Aragua', point: { latitude: 10.213, longitude: -67.423 }, icon: 'place' },
    { label: 'Palo Negro', detail: 'Ciudad · Libertador · Aragua', point: { latitude: 10.173, longitude: -67.544 }, icon: 'place' },
    { label: 'Santa Rita', detail: 'Sector urbano · Francisco Linares Alcántara · Aragua', point: { latitude: 10.205, longitude: -67.559 }, icon: 'place' },
    { label: 'Villa de Cura', detail: 'Ciudad · Zamora · Aragua', point: { latitude: 10.038, longitude: -67.489 }, icon: 'place' },
    { label: 'La Colonia Tovar', detail: 'Pueblo turístico · Aragua', point: { latitude: 10.413, longitude: -67.291 }, icon: 'place' },
    { label: 'Ocumare de la Costa', detail: 'Sector costero · Aragua', point: { latitude: 10.462, longitude: -67.769 }, icon: 'beach_access' },
    { label: 'Choroní', detail: 'Sector costero · Aragua', point: { latitude: 10.495, longitude: -67.61 }, icon: 'beach_access' },
    { label: 'Puerto Colombia', detail: 'Sector costero · Choroní · Aragua', point: { latitude: 10.5, longitude: -67.606 }, icon: 'beach_access' },
    { label: 'Terminal de Maracay', detail: 'Terminal terrestre · Aragua', point: { latitude: 10.246, longitude: -67.604 }, icon: 'directions_bus' },
    { label: 'Parque Metropolitano de Maracay', detail: 'Parque · Maracay · Aragua', point: { latitude: 10.25, longitude: -67.59 }, icon: 'park' },
    { label: 'Avenida Bolívar de Maracay', detail: 'Eje vial y comercial · Maracay · Aragua', point: { latitude: 10.247, longitude: -67.597 }, icon: 'alt_route' },
    { label: 'Avenida Las Delicias', detail: 'Eje vial · Maracay · Aragua', point: { latitude: 10.261, longitude: -67.595 }, icon: 'alt_route' },
    { label: 'Avenida Constitución', detail: 'Eje vial · Maracay · Aragua', point: { latitude: 10.251, longitude: -67.608 }, icon: 'alt_route' },
    { label: 'La Cooperativa', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.259, longitude: -67.604 }, icon: 'place' },
    { label: 'San Jacinto', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.258, longitude: -67.615 }, icon: 'place' },
    { label: 'Base Aragua', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.246, longitude: -67.575 }, icon: 'place' },
    { label: 'El Castaño', detail: 'Sector norte · Maracay · Aragua', point: { latitude: 10.289, longitude: -67.596 }, icon: 'place' },
    { label: 'La Barraca', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.236, longitude: -67.602 }, icon: 'place' },
    { label: 'Santa Rosa Maracay', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.238, longitude: -67.589 }, icon: 'place' },
    { label: 'San Isidro Maracay', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.256, longitude: -67.584 }, icon: 'place' },
    { label: 'Piñonal', detail: 'Sector urbano · Maracay · Aragua', point: { latitude: 10.227, longitude: -67.597 }, icon: 'place' },
    { label: 'La Morita', detail: 'Sector urbano · Francisco Linares Alcántara · Aragua', point: { latitude: 10.209, longitude: -67.56 }, icon: 'place' },
    { label: 'Centro Comercial Parque Aragua', detail: 'Centro comercial · Maracay · Aragua', point: { latitude: 10.249, longitude: -67.593 }, icon: 'local_mall' },
    { label: 'Centro Comercial Las Américas Maracay', detail: 'Centro comercial · Maracay · Aragua', point: { latitude: 10.2439, longitude: -67.6065 }, icon: 'local_mall' },
    { label: 'Mercado Principal de Maracay', detail: 'Mercado · Maracay · Aragua', point: { latitude: 10.247, longitude: -67.604 }, icon: 'storefront' },
    { label: 'Hospital Central de Maracay', detail: 'Hospital · Maracay · Aragua', point: { latitude: 10.2464, longitude: -67.5963 }, icon: 'local_hospital' },
    { label: 'La Victoria Centro', detail: 'Centro urbano · Ribas · Aragua', point: { latitude: 10.2268, longitude: -67.3335 }, icon: 'place' },
    { label: 'La Mora', detail: 'Sector urbano · La Victoria · Aragua', point: { latitude: 10.236, longitude: -67.342 }, icon: 'place' },
    { label: 'Las Mercedes La Victoria', detail: 'Sector urbano · La Victoria · Aragua', point: { latitude: 10.232, longitude: -67.327 }, icon: 'place' },
    { label: 'Calicanto La Victoria', detail: 'Sector urbano · La Victoria · Aragua', point: { latitude: 10.219, longitude: -67.339 }, icon: 'place' },
    { label: 'El Recreo La Victoria', detail: 'Sector urbano · La Victoria · Aragua', point: { latitude: 10.224, longitude: -67.323 }, icon: 'place' },
    { label: 'Hospital José María Benítez', detail: 'Hospital · La Victoria · Aragua', point: { latitude: 10.225, longitude: -67.335 }, icon: 'local_hospital' },
    { label: 'Avenida Francisco de Miranda La Victoria', detail: 'Eje vial · La Victoria · Aragua', point: { latitude: 10.228, longitude: -67.333 }, icon: 'alt_route' },
    { label: 'Turmero Centro', detail: 'Centro urbano · Santiago Mariño · Aragua', point: { latitude: 10.228, longitude: -67.474 }, icon: 'place' },
    { label: 'La Encrucijada', detail: 'Distribuidor y sector vial · Aragua', point: { latitude: 10.213, longitude: -67.478 }, icon: 'alt_route' },
    { label: 'Samán de Güere', detail: 'Sector urbano · Turmero · Aragua', point: { latitude: 10.216, longitude: -67.491 }, icon: 'place' },
    { label: 'Rosario de Paya', detail: 'Sector urbano · Santiago Mariño · Aragua', point: { latitude: 10.234, longitude: -67.452 }, icon: 'place' },
    { label: 'San Pablo Turmero', detail: 'Sector urbano · Turmero · Aragua', point: { latitude: 10.232, longitude: -67.484 }, icon: 'place' },
    { label: 'Valle Lindo Turmero', detail: 'Sector urbano · Turmero · Aragua', point: { latitude: 10.225, longitude: -67.486 }, icon: 'place' },
    { label: 'Centro Comercial Turmero Plaza', detail: 'Centro comercial · Turmero · Aragua', point: { latitude: 10.2241, longitude: -67.4712 }, icon: 'local_mall' },
    { label: 'Avenida Intercomunal Turmero Maracay', detail: 'Eje vial · Aragua', point: { latitude: 10.222, longitude: -67.505 }, icon: 'alt_route' },
    { label: 'Cagua Centro', detail: 'Centro urbano · Sucre · Aragua', point: { latitude: 10.186, longitude: -67.46 }, icon: 'place' },
    { label: 'La Carpiera', detail: 'Sector urbano · Cagua · Aragua', point: { latitude: 10.17, longitude: -67.444 }, icon: 'place' },
    { label: 'Corinsa', detail: 'Sector industrial · Cagua · Aragua', point: { latitude: 10.19, longitude: -67.448 }, icon: 'storefront' },
    { label: 'Bella Vista Cagua', detail: 'Sector urbano · Cagua · Aragua', point: { latitude: 10.185, longitude: -67.451 }, icon: 'place' },
    { label: 'Santa Rosalía Cagua', detail: 'Sector urbano · Cagua · Aragua', point: { latitude: 10.181, longitude: -67.465 }, icon: 'place' },
    { label: 'Avenida Bolívar de Cagua', detail: 'Eje vial · Cagua · Aragua', point: { latitude: 10.187, longitude: -67.46 }, icon: 'alt_route' },
    { label: 'El Limón Centro', detail: 'Centro urbano · Mario Briceño Iragorry · Aragua', point: { latitude: 10.305, longitude: -67.633 }, icon: 'place' },
    { label: 'El Progreso El Limón', detail: 'Sector urbano · El Limón · Aragua', point: { latitude: 10.309, longitude: -67.637 }, icon: 'place' },
    { label: 'Avenida Universidad El Limón', detail: 'Eje vial · El Limón · Aragua', point: { latitude: 10.302, longitude: -67.63 }, icon: 'alt_route' },
    { label: 'Caña de Azúcar Sector 1', detail: 'Sector urbano · Aragua', point: { latitude: 10.287, longitude: -67.628 }, icon: 'place' },
    { label: 'José Félix Ribas Aragua', detail: 'Sector urbano · Aragua', point: { latitude: 10.283, longitude: -67.622 }, icon: 'place' },
    { label: 'Palo Negro Centro', detail: 'Centro urbano · Libertador · Aragua', point: { latitude: 10.173, longitude: -67.544 }, icon: 'place' },
    { label: 'Santa Cruz de Aragua', detail: 'Ciudad · José Ángel Lamas · Aragua', point: { latitude: 10.186, longitude: -67.511 }, icon: 'place' },
    { label: 'Valencia', detail: 'Ciudad · Carabobo', point: { latitude: 10.181, longitude: -68.004 }, icon: 'place' },
    { label: 'Naguanagua', detail: 'Ciudad · Carabobo', point: { latitude: 10.258, longitude: -68.018 }, icon: 'place' },
    { label: 'San Diego', detail: 'Municipio · Carabobo', point: { latitude: 10.254, longitude: -67.954 }, icon: 'place' },
    { label: 'Guacara', detail: 'Ciudad · Carabobo', point: { latitude: 10.226, longitude: -67.877 }, icon: 'place' },
    { label: 'Los Guayos', detail: 'Ciudad · Carabobo', point: { latitude: 10.189, longitude: -67.939 }, icon: 'place' },
    { label: 'Tocuyito', detail: 'Ciudad · Libertador · Carabobo', point: { latitude: 10.113, longitude: -68.067 }, icon: 'place' },
    { label: 'Puerto Cabello', detail: 'Ciudad portuaria · Carabobo', point: { latitude: 10.473, longitude: -68.012 }, icon: 'directions_boat' },
    { label: 'Morón', detail: 'Ciudad · Juan José Mora · Carabobo', point: { latitude: 10.487, longitude: -68.2 }, icon: 'place' },
    { label: 'Bejuma', detail: 'Ciudad · Carabobo', point: { latitude: 10.174, longitude: -68.258 }, icon: 'place' },
    { label: 'Mariara', detail: 'Ciudad · Diego Ibarra · Carabobo', point: { latitude: 10.296, longitude: -67.719 }, icon: 'place' },
    { label: 'Prebo', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.211, longitude: -68.015 }, icon: 'place' },
    { label: 'El Viñedo', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.213, longitude: -68.006 }, icon: 'storefront' },
    { label: 'La Isabelica', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.165, longitude: -67.966 }, icon: 'place' },
    { label: 'Flor Amarillo', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.173, longitude: -67.93 }, icon: 'place' },
    { label: 'Universidad de Carabobo Bárbula', detail: 'Universidad · Naguanagua · Carabobo', point: { latitude: 10.272, longitude: -68.009 }, icon: 'school' },
    { label: 'Forum Valencia', detail: 'Centro de eventos · Valencia · Carabobo', point: { latitude: 10.204, longitude: -68.012 }, icon: 'stadium' },
    { label: 'C.C. Metrópolis Valencia', detail: 'Centro comercial · Valencia · Carabobo', point: { latitude: 10.196, longitude: -67.981 }, icon: 'local_mall' },
    { label: 'Terminal Big Low Center', detail: 'Terminal terrestre · Valencia · Carabobo', point: { latitude: 10.183, longitude: -68.018 }, icon: 'directions_bus' },
    { label: 'Valencia Centro', detail: 'Centro urbano · Carabobo', point: { latitude: 10.181, longitude: -68.004 }, icon: 'place' },
    { label: 'Avenida Bolívar Norte Valencia', detail: 'Eje vial · Valencia · Carabobo', point: { latitude: 10.203, longitude: -68.011 }, icon: 'alt_route' },
    { label: 'Avenida Cedeño Valencia', detail: 'Eje vial · Valencia · Carabobo', point: { latitude: 10.18, longitude: -68.006 }, icon: 'alt_route' },
    { label: 'La Candelaria Valencia', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.179, longitude: -68.011 }, icon: 'place' },
    { label: 'El Trigal', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.225, longitude: -68.014 }, icon: 'place' },
    { label: 'Camoruco', detail: 'Sector urbano · Valencia · Carabobo', point: { latitude: 10.217, longitude: -68.011 }, icon: 'place' },
    { label: 'La Granja Naguanagua', detail: 'Sector urbano · Naguanagua · Carabobo', point: { latitude: 10.245, longitude: -68.015 }, icon: 'place' },
    { label: 'Mañongo', detail: 'Sector urbano · Naguanagua · Carabobo', point: { latitude: 10.252, longitude: -68.012 }, icon: 'place' },
    { label: 'Tazajal', detail: 'Sector urbano · Naguanagua · Carabobo', point: { latitude: 10.242, longitude: -68.025 }, icon: 'place' },
    { label: 'La Entrada Naguanagua', detail: 'Sector norte · Naguanagua · Carabobo', point: { latitude: 10.294, longitude: -68.014 }, icon: 'place' },
    { label: 'Sambil Valencia', detail: 'Centro comercial · Naguanagua · Carabobo', point: { latitude: 10.2225, longitude: -68.0101 }, icon: 'local_mall' },
    { label: 'San Diego Pueblo', detail: 'Centro urbano · San Diego · Carabobo', point: { latitude: 10.254, longitude: -67.954 }, icon: 'place' },
    { label: 'El Morro San Diego', detail: 'Sector urbano · San Diego · Carabobo', point: { latitude: 10.264, longitude: -67.963 }, icon: 'place' },
    { label: 'La Esmeralda San Diego', detail: 'Sector urbano · San Diego · Carabobo', point: { latitude: 10.249, longitude: -67.96 }, icon: 'place' },
    { label: 'Los Jarales', detail: 'Sector urbano · San Diego · Carabobo', point: { latitude: 10.244, longitude: -67.963 }, icon: 'place' },
    { label: 'El Tulipán', detail: 'Sector urbano · San Diego · Carabobo', point: { latitude: 10.239, longitude: -67.971 }, icon: 'place' },
    { label: 'Castillito', detail: 'Sector urbano · San Diego · Carabobo', point: { latitude: 10.228, longitude: -67.975 }, icon: 'place' },
    { label: 'Terrazas de San Diego', detail: 'Sector urbano · San Diego · Carabobo', point: { latitude: 10.25, longitude: -67.971 }, icon: 'place' },
    { label: 'Guacara Centro', detail: 'Centro urbano · Guacara · Carabobo', point: { latitude: 10.226, longitude: -67.877 }, icon: 'place' },
    { label: 'Ciudad Alianza', detail: 'Sector urbano · Guacara · Carabobo', point: { latitude: 10.209, longitude: -67.914 }, icon: 'place' },
    { label: 'Yagua', detail: 'Sector urbano · Guacara · Carabobo', point: { latitude: 10.249, longitude: -67.897 }, icon: 'place' },
    { label: 'Paraparal', detail: 'Sector urbano · Los Guayos · Carabobo', point: { latitude: 10.204, longitude: -67.942 }, icon: 'place' },
    { label: 'Los Guayos Centro', detail: 'Centro urbano · Carabobo', point: { latitude: 10.189, longitude: -67.939 }, icon: 'place' },
    { label: 'Puerto Cabello Centro', detail: 'Centro urbano y puerto · Carabobo', point: { latitude: 10.473, longitude: -68.012 }, icon: 'directions_boat' },
    { label: 'La Sorpresa Puerto Cabello', detail: 'Sector urbano · Puerto Cabello · Carabobo', point: { latitude: 10.467, longitude: -68.012 }, icon: 'place' },
    { label: 'Borburata', detail: 'Sector costero · Puerto Cabello · Carabobo', point: { latitude: 10.469, longitude: -67.961 }, icon: 'beach_access' },
    { label: 'Patanemo', detail: 'Sector costero · Puerto Cabello · Carabobo', point: { latitude: 10.433, longitude: -67.92 }, icon: 'beach_access' },
    { label: 'Hospital Dr. Adolfo Prince Lara', detail: 'Hospital · Puerto Cabello · Carabobo', point: { latitude: 10.4699, longitude: -68.0121 }, icon: 'local_hospital' },
    { label: 'Ciudad Hospitalaria Dr. Enrique Tejera', detail: 'Hospital · Valencia · Carabobo', point: { latitude: 10.1795, longitude: -68.0039 }, icon: 'local_hospital' },
  ];
  private previewCloseTimer?: number;
  private sessionExpiryTimer?: number;
  private readonly copy: Record<Language, Record<string, string>> = {
    es: {
      'search.placeholder': 'Buscar edificio, refugio o centro de acopio',
      'search.action': 'Buscar',
      'notice.text': 'La información mostrada en este mapa está en constante actualización y revisión. No entres a estructuras dañadas y realiza reportes con la mayor precisión posible.',
      'notice.close': 'Entendido',
      'module.reporte': 'Reporte',
      'module.sismos': 'Sismos',
      'module.edificios': 'Edificios',
      'module.mapas-dano': 'Mapa de Daño',
      'module.centros-acopio': 'Centros de Acopio',
      'module.refugios-personas': 'Refugios de Personas',
      'module.refugios-animales': 'Refugios de Animales',
      'module.numeros-emergencia': 'Números de Emergencia',
      'module.mapa-cartografico': 'Mapa Cartográfico',
      'module.terminos-uso': 'Términos de Uso',
      'module.contacto': 'Contacto',
      'module.aprobar': 'Aprobar Reportes',
      'module.perfil': 'Perfil',
      'drawer.add-acopio': 'Añadir Centro de Acopio',
      'drawer.add-refugio-personas': 'Añadir Refugio de Personas',
      'drawer.add-refugio-animales': 'Añadir Refugio de Animales',
      'mobile.acopio': 'Acopio',
      'mobile.refugios': 'Refugios',
      'mobile.more': 'Más',
      'preview.structure': 'Edificación',
      'preview.relief': 'Refugio o acopio',
      'panel.activePoint': 'Punto activo',
      'action.refresh': 'Actualizar',
      'metric.zones': 'Zonas',
      'metric.critical': 'Críticas',
      'metric.collectionCenters': 'Centros Acopio',
      'metric.buildings': 'Edificios',
      'metric.peopleShelters': 'Refugios Personas',
      'metric.animalShelters': 'Refugios Animales',
      'metric.shelters': 'Refugios',
      'metric.modal.title': 'Resumen de edificios',
      'metric.modal.close': 'Cerrar resumen',
      'metric.modal.total': 'Edificios visibles en el mapa',
      'metric.modal.collapsed': 'Derrumbado / parcial',
      'metric.modal.structural': 'Daño estructural',
      'metric.modal.light': 'Daño leve o superficial',
      'metric.modal.unknown': 'Por confirmar',
      'metric.collection.modal.title': 'Resumen de centros de acopio',
      'metric.collection.modal.total': 'Centros de acopio registrados',
      'metric.collection.modal.national': 'Nacionales en mapa',
      'metric.collection.modal.international': 'Internacionales',
      'legend.title': 'Leyenda del mapa',
      'legend.subtitle': 'Colores de puntos visibles en el mapa',
      'legend.close': 'Cerrar leyenda',
      'legend.building.collapsed': 'Edificio derrumbado / parcial',
      'legend.building.structural': 'Edificio con daño estructural',
      'legend.building.light': 'Edificio con daño leve',
      'legend.relief.people': 'Refugio de personas',
      'legend.relief.animals': 'Refugio de animales',
      'legend.relief.supplies': 'Centro de acopio',
      'legend.reference': 'Punto de referencia',
      'map.gps': 'GPS',
      'map.center': 'Centro',
      'map.satellite': 'Satélite',
      'map.map': 'Mapa',
      'guide.button': 'Cómo reportar',
      'guide.title': 'Guía para Reportar',
      'guide.subtitle': 'Comparte información útil sobre daños, refugios y centros de acopio sin ponerte en riesgo.',
      'guide.close': 'Cerrar guía',
      'guide.footer': 'Los aportes anónimos pasan por revisión antes de publicarse. Si hay peligro inmediato, llama primero a emergencias locales.',
      'report.title': 'Reportar Edificación',
      'report.name': 'Nombre',
      'report.contact': 'Contacto',
      'report.structure': 'Casa, edificio o negocio',
      'report.observed': 'Situación observada',
      'report.validation': 'Describe la situación con al menos 12 caracteres.',
      'report.point': 'Punto del reporte',
      'report.submit': 'Enviar reporte anónimo',
      'report.sending': 'Enviando',
      'terms.title': 'Términos de Uso',
      'terms.updated': 'Última actualización: 30 de junio de 2026',
      'terms.lead': 'DondeAyudoVenezuela es una herramienta comunitaria y gratuita para consultar, reportar y revisar información sobre edificaciones afectadas, refugios y centros de acopio.',
      'profile.title': 'Perfil operativo',
      'profile.active': 'Activo',
      'profile.inactive': 'Sin sesión',
      'profile.user': 'Usuario',
      'profile.password': 'Clave',
      'profile.login': 'Entrar',
      'profile.logout': 'Cerrar sesión',
      'profile.name': 'Nombre',
      'profile.email': 'Email',
      'profile.roles': 'Roles',
      'profile.expires': 'Sesión válida hasta',
      'profile.note.access': 'El inicio de sesión es sólo para moderadores y administradores.',
      'profile.note.public': 'Para consultar el mapa o enviar reportes anónimos no necesitas una cuenta.',
      'profile.registration-note': 'Si fue aprobado o recomendado como moderador, por favor llene el formulario de registro.',
      'profile.register': 'Registrarse como moderador',
      'delete.title': 'Retirar de la capa pública',
      'delete.status.direct': 'Aplicación directa',
      'delete.status.review': 'Requiere aprobación',
      'delete.body': 'Usa esta acción sólo si el punto está duplicado, no corresponde al lugar, contiene información sensible o ya no debe mostrarse públicamente.',
      'delete.action.direct': 'Borrar del mapa',
      'delete.action.review': 'Solicitar eliminación',
      'delete.confirm.direct': 'Esta acción retirará el punto de la capa pública. ¿Deseas continuar?',
      'delete.confirm.review': 'Se enviará una solicitud para retirar este punto de la capa pública. ¿Deseas continuar?',
      'delete.pending': 'Eliminación solicitada',
      'delete.approved': 'Retirado de la capa pública',
      'change.photo': 'Foto',
      'change.location': 'Ubicación',
      'change.delete': 'Eliminación',
      'change.supply': 'Insumo',
    },
    en: {
      'search.placeholder': 'Search building, shelter, or supply center',
      'search.action': 'Search',
      'notice.text': 'The information shown on this map is constantly updated and reviewed. Do not enter damaged structures and submit reports as accurately as possible.',
      'notice.close': 'Got it',
      'module.reporte': 'Report',
      'module.sismos': 'Earthquakes',
      'module.edificios': 'Buildings',
      'module.mapas-dano': 'Damage Map',
      'module.centros-acopio': 'Supply Centers',
      'module.refugios-personas': 'People Shelters',
      'module.refugios-animales': 'Animal Shelters',
      'module.numeros-emergencia': 'Emergency Numbers',
      'module.mapa-cartografico': 'Cartographic Map',
      'module.terminos-uso': 'Terms of Use',
      'module.contacto': 'Contact',
      'module.aprobar': 'Approve Reports',
      'module.perfil': 'Profile',
      'drawer.add-acopio': 'Add Supply Center',
      'drawer.add-refugio-personas': 'Add People Shelter',
      'drawer.add-refugio-animales': 'Add Animal Shelter',
      'mobile.acopio': 'Supply',
      'mobile.refugios': 'Shelters',
      'mobile.more': 'More',
      'preview.structure': 'Building',
      'preview.relief': 'Shelter or supply center',
      'panel.activePoint': 'Active point',
      'action.refresh': 'Refresh',
      'metric.zones': 'Zones',
      'metric.critical': 'Critical',
      'metric.collectionCenters': 'Supply Centers',
      'metric.buildings': 'Buildings',
      'metric.peopleShelters': 'People Shelters',
      'metric.animalShelters': 'Animal Shelters',
      'metric.shelters': 'Shelters',
      'metric.modal.title': 'Building summary',
      'metric.modal.close': 'Close summary',
      'metric.modal.total': 'Visible buildings on map',
      'metric.modal.collapsed': 'Collapsed / partial collapse',
      'metric.modal.structural': 'Structural damage',
      'metric.modal.light': 'Minor or superficial damage',
      'metric.modal.unknown': 'To be confirmed',
      'metric.collection.modal.title': 'Supply center summary',
      'metric.collection.modal.total': 'Registered supply centers',
      'metric.collection.modal.national': 'National on map',
      'metric.collection.modal.international': 'International',
      'legend.title': 'Map Legend',
      'legend.subtitle': 'Colors for visible map points',
      'legend.close': 'Close legend',
      'legend.building.collapsed': 'Collapsed / partially collapsed building',
      'legend.building.structural': 'Building with structural damage',
      'legend.building.light': 'Building with minor damage',
      'legend.relief.people': 'People shelter',
      'legend.relief.animals': 'Animal shelter',
      'legend.relief.supplies': 'Supply center',
      'legend.reference': 'Reference point',
      'map.gps': 'GPS',
      'map.center': 'Center',
      'map.satellite': 'Satellite',
      'map.map': 'Map',
      'guide.button': 'How to report',
      'guide.title': 'Reporting Guide',
      'guide.subtitle': 'Share useful information about damage, shelters, and supply centers without putting yourself at risk.',
      'guide.close': 'Close guide',
      'guide.footer': 'Anonymous contributions are reviewed before publication. If there is immediate danger, call local emergency services first.',
      'report.title': 'Report Building',
      'report.name': 'Name',
      'report.contact': 'Contact',
      'report.structure': 'House, building, or business',
      'report.observed': 'Observed situation',
      'report.validation': 'Describe the situation with at least 12 characters.',
      'report.point': 'Report point',
      'report.submit': 'Submit anonymous report',
      'report.sending': 'Sending',
      'terms.title': 'Terms of Use',
      'terms.updated': 'Last updated: June 30, 2026',
      'terms.lead': 'DondeAyudoVenezuela is a free community tool for checking, reporting, and reviewing information about affected buildings, shelters, and supply centers.',
      'profile.title': 'Operational profile',
      'profile.active': 'Active',
      'profile.inactive': 'Signed out',
      'profile.user': 'User',
      'profile.password': 'Password',
      'profile.login': 'Sign in',
      'profile.logout': 'Sign out',
      'profile.name': 'Name',
      'profile.email': 'Email',
      'profile.roles': 'Roles',
      'profile.expires': 'Session valid until',
      'profile.note.access': 'Sign-in is only for moderators and administrators.',
      'profile.note.public': 'You do not need an account to view the map or submit anonymous reports.',
      'profile.registration-note': 'If you were approved or recommended as a moderator, please complete the registration form.',
      'profile.register': 'Register as moderator',
      'delete.title': 'Remove from public layer',
      'delete.status.direct': 'Direct action',
      'delete.status.review': 'Requires approval',
      'delete.body': 'Use this action only when the point is duplicated, misplaced, contains sensitive information, or should no longer be shown publicly.',
      'delete.action.direct': 'Remove from map',
      'delete.action.review': 'Request removal',
      'delete.confirm.direct': 'This action will remove the point from the public layer. Continue?',
      'delete.confirm.review': 'A removal request will be sent for this public point. Continue?',
      'delete.pending': 'Removal requested',
      'delete.approved': 'Removed from public layer',
      'change.photo': 'Photo',
      'change.location': 'Location',
      'change.delete': 'Removal',
      'change.supply': 'Supply need',
    },
  };

  protected readonly topModules: Array<{ key: ModuleKey; label: string }> = [
    { key: 'reporte', label: 'Reporte' },
    { key: 'sismos', label: 'Sismos' },
    { key: 'edificios', label: 'Edificios' },
    { key: 'mapas-dano', label: 'Mapa de Daño' },
    { key: 'centros-acopio', label: 'Centros de Acopio' },
    { key: 'refugios-personas', label: 'Refugios de Personas' },
    { key: 'refugios-animales', label: 'Refugios de Animales' },
    { key: 'numeros-emergencia', label: 'Números de Emergencia' },
  ];

  protected readonly drawerItems: DrawerItem[] = [
    { key: 'reporte', label: 'Reporte', icon: 'edit_location_alt' },
    { key: 'sismos', label: 'Sismos', icon: 'monitor_heart' },
    { key: 'edificios', label: 'Edificios', icon: 'apartment' },
    { key: 'mapas-dano', label: 'Mapa de Daño', icon: 'travel_explore' },
    { key: 'centros-acopio', label: 'Centros de Acopio', icon: 'inventory_2' },
    { key: 'refugios-personas', label: 'Refugios de Personas', icon: 'home_health' },
    { key: 'refugios-animales', label: 'Refugios de Animales', icon: 'pets' },
    { key: 'numeros-emergencia', label: 'Números de Emergencia', icon: 'phone_in_talk' },
    { key: 'mapa-cartografico', label: 'Mapa Cartográfico', icon: 'terrain' },
    { key: 'terminos-uso', label: 'Términos de Uso', icon: 'policy' },
    { key: 'contacto', label: 'Contacto', icon: 'person_add' },
    { key: 'aprobar', label: 'Aprobar Reportes', icon: 'fact_check', requiresAuth: true },
    { key: 'perfil', label: 'Perfil', icon: 'account_circle' },
    { key: 'add-acopio', label: 'Añadir Centro de Acopio', icon: 'add_business' },
    { key: 'add-refugio-personas', label: 'Añadir Refugio de Personas', icon: 'add_home_work' },
    { key: 'add-refugio-animales', label: 'Añadir Refugio de Animales', icon: 'pets' },
  ];

  protected readonly activeModule = signal<ModuleKey>('reporte');
  protected readonly drawerOpen = signal(false);
  protected readonly language = signal<Language>('es');
  protected readonly noticeVisible = signal(this.shouldShowFirstVisitNotice());
  protected readonly reportGuideOpen = signal(false);
  protected readonly buildingSummaryOpen = signal(false);
  protected readonly collectionCenterSummaryOpen = signal(false);
  protected readonly mobileLegendOpen = signal(false);
  protected readonly moderationHistoryModal = signal<ModerationHistoryKind | null>(null);
  protected readonly registrationFormOpen = signal(false);
  protected readonly passwordDialogOpen = signal(false);
  protected readonly summaryCollapsed = signal(false);
  protected readonly panelCollapsed = signal(false);
  protected readonly mobileViewport = signal(this.matchesMobileViewport());
  protected readonly mobileMapToolsOpen = signal(false);
  protected readonly mobileHelpToolsOpen = signal(false);
  protected readonly mapMode = signal<'map' | 'satellite'>('map');
  protected readonly donationScope = signal<DonationScope>('national');
  protected readonly zones = signal<AffectedZone[]>([]);
  protected readonly structures = signal<Structure[]>([]);
  protected readonly reliefCenters = signal<ReliefCenter[]>([]);
  protected readonly seismicEvents = signal<SeismicEvent[]>([]);
  protected readonly emergencyContacts = signal<EmergencyContact[]>([]);
  protected readonly intakeReports = signal<BackofficeIntakeReport[]>([]);
  protected readonly technicalFileChanges = signal<TechnicalFileChange[]>([]);
  protected readonly userRegistrations = signal<UserRegistration[]>([]);
  protected readonly selectedTechnicalFile = signal<TechnicalFile | null>(null);
  protected readonly mapPreview = signal<MapPreview | null>(null);
  protected readonly photoPreview = signal<{ url: string; caption: string } | null>(null);
  protected readonly submitConfirmation = signal<SubmitConfirmationDialog | null>(null);
  protected readonly selectedPoint = signal<GeoPoint>({ longitude: -66.9036, latitude: 10.4806 });
  protected readonly credentials = signal<BasicAuthCredentials | null>(null);
  protected readonly currentUser = signal<CurrentUser | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly reportAddressTerm = signal('');
  protected readonly reliefAddressTerm = signal('');
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly contactSubmitting = signal(false);
  protected readonly registrationSubmitting = signal(false);
  protected readonly passwordChanging = signal(false);
  protected readonly adminLoading = signal(false);
  protected readonly technicalFileLoading = signal(false);
  protected readonly locationEditMode = signal(false);
  protected readonly locationSubmitting = signal(false);
  protected readonly deleteSubmitting = signal(false);
  protected readonly structureStatusSubmitting = signal(false);
  protected readonly structureDescriptionEditMode = signal(false);
  protected readonly structureDescriptionSubmitting = signal(false);
  protected readonly supplyNeedSubmittingId = signal<number | null>(null);
  protected readonly reliefSubmitting = signal(false);
  protected readonly reliefCreateMode = signal<ReliefCreateType | null>(null);
  protected readonly moderatingReportId = signal<number | null>(null);
  protected readonly moderatingChangeId = signal<number | null>(null);
  protected readonly reviewingUserRegistrationId = signal<number | null>(null);
  protected readonly statusMessage = signal('Mapa operativo centrado en Caracas.');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly adminErrorMessage = signal<string | null>(null);
  protected readonly contactMessage = signal<string | null>(null);
  protected readonly registrationMessage = signal<string | null>(null);
  protected readonly usernameAvailabilityMessage = signal<string | null>(null);
  protected readonly contributionDialogMessage = signal<string | null>(null);
  protected readonly reportModerationHistory = signal<ModerationHistoryItem[]>([]);
  protected readonly userModerationHistory = signal<ModerationHistoryItem[]>([]);
  protected readonly lastIntakeId = signal<number | null>(null);
  protected readonly cartographicModalOpen = signal(false);
  protected readonly damageLevelOptions = ['UNKNOWN', 'NONE_VISIBLE', 'MINOR', 'MODERATE', 'SEVERE', 'PARTIAL_COLLAPSE', 'TOTAL_COLLAPSE'];
  protected readonly severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  protected readonly operationalStatusOptions = ['PENDING_ASSESSMENT', 'SEARCH_AND_RESCUE', 'DEBRIS_REMOVAL', 'STABILIZED', 'CLEARED', 'RESTRICTED'];
  protected readonly verificationStatusOptions = ['BASELINE', 'REPORTED', 'IN_REVIEW', 'VERIFIED', 'REJECTED'];
  protected readonly reliefCreateLabels: Record<ReliefCreateType, string> = {
    COLLECTION_CENTER: 'Centro de Acopio',
    SHELTER: 'Refugio de Personas',
    ANIMAL_SHELTER: 'Refugio de Animales',
  };
  protected readonly reliefCreateIcons: Record<ReliefCreateType, string> = {
    COLLECTION_CENTER: 'inventory_2',
    SHELTER: 'home_health',
    ANIMAL_SHELTER: 'pets',
  };

  protected readonly criticalCount = computed(
    () => this.zones().filter((zone) => zone.severity === 'CRITICAL').length,
  );
  protected readonly highStructureCount = computed(
    () => this.structures().filter((structure) => ['HIGH', 'CRITICAL'].includes(structure.currentSeverity)).length,
  );
  protected readonly structureDamageSummary = computed(() => {
    const structures = this.structures();
    return {
      total: structures.length,
      collapsed: structures.filter((structure) => ['TOTAL_COLLAPSE', 'PARTIAL_COLLAPSE'].includes(structure.currentDamageLevel)).length,
      structural: structures.filter((structure) => ['SEVERE', 'MODERATE'].includes(structure.currentDamageLevel)).length,
      light: structures.filter((structure) => ['MINOR', 'NONE_VISIBLE'].includes(structure.currentDamageLevel)).length,
      unknown: structures.filter((structure) => !['TOTAL_COLLAPSE', 'PARTIAL_COLLAPSE', 'SEVERE', 'MODERATE', 'MINOR', 'NONE_VISIBLE'].includes(structure.currentDamageLevel)).length,
    };
  });
  protected readonly peopleReliefCenters = computed(() =>
    this.reliefCenters().filter((center) => center.acceptsPeople && !center.international),
  );
  protected readonly animalReliefCenters = computed(() =>
    this.reliefCenters().filter((center) => center.acceptsAnimals && !center.international),
  );
  protected readonly donationCenters = computed(() =>
    this.reliefCenters().filter((center) => center.acceptsDonations && !center.international),
  );
  protected readonly internationalDonationCenters = computed(() =>
    this.reliefCenters().filter((center) => center.acceptsDonations && Boolean(center.international)),
  );
  protected readonly visibleDonationCenters = computed(() =>
    this.donationScope() === 'international' ? this.internationalDonationCenters() : this.donationCenters(),
  );
  protected readonly pendingReports = computed(() =>
    this.intakeReports().filter((report) => ['RECEIVED', 'ASSIGNED', 'IN_REVIEW'].includes(report.status)),
  );
  protected readonly pendingTechnicalFileChanges = computed(() =>
    this.technicalFileChanges().filter((change) => change.status === 'PENDING'),
  );
  protected readonly pendingUserRegistrations = computed(() =>
    this.userRegistrations().filter((registration) => registration.status === 'PENDING_REVIEW'),
  );
  protected readonly latestSeismicEvent = computed(() => this.seismicEvents()[0] ?? null);
  protected readonly isAuthenticated = computed(() => this.credentials() !== null);
  protected readonly isAdmin = computed(() => this.currentUser()?.roles.includes('ADMIN') ?? false);
  protected readonly canModerate = computed(() => {
    const roles = this.currentUser()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MODERATOR');
  });
  protected readonly selectedFileTitle = computed(() => {
    const file = this.selectedTechnicalFile();
    return file?.structure?.name || file?.reliefCenter?.name || 'Ficha técnica';
  });
  protected readonly searchSuggestions = computed(() => {
    const term = this.normalize(this.searchTerm());
    if (!term) {
      return [];
    }
    return this.searchCandidates()
      .filter((candidate) => this.normalize(`${candidate.label} ${candidate.detail}`).includes(term))
      .slice(0, 8);
  });
  protected readonly reportAddressSuggestions = computed(() =>
    this.addressReferenceSuggestions(this.reportAddressTerm()),
  );
  protected readonly reliefAddressSuggestions = computed(() =>
    this.addressReferenceSuggestions(this.reliefAddressTerm()),
  );
  protected readonly photoSlots = [0, 1, 2];

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly reportForm: ReportForm = new FormGroup({
    addressText: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    structureName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(180)] }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(5000)],
    }),
    professionalInspectionReceived: new FormControl(false, { nonNullable: true }),
    evacuated: new FormControl(false, { nonNullable: true }),
    displacedPeopleReported: new FormControl(false, { nonNullable: true }),
  });
  protected readonly reportSupplyControl = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] });
  protected readonly reportSupplyNeeds = signal<string[]>([]);
  protected readonly reportPhotoDrafts = signal<Array<TechnicalFilePhotoDraft | null>>([null, null, null]);
  protected readonly authForm: AuthForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly passwordChangeForm: PasswordChangeForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(120)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(120)] }),
    repeatPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(120)] }),
  });
  protected readonly contactForm: ContactForm = new FormGroup({
    senderName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    senderEmail: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(180)] }),
    messageBody: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(5000)],
    }),
  });
  protected readonly registrationForm: RegistrationForm = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(80), Validators.pattern(/^[a-zA-Z0-9_.-]+$/)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(120)] }),
    repeatPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(180)] }),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
  });
  protected readonly structureEditForm: StructureEditForm = new FormGroup({
    currentDamageLevel: new FormControl('UNKNOWN', { nonNullable: true, validators: [Validators.required] }),
    currentSeverity: new FormControl('MEDIUM', { nonNullable: true, validators: [Validators.required] }),
    currentOperationalStatus: new FormControl('PENDING_ASSESSMENT', { nonNullable: true, validators: [Validators.required] }),
    verificationStatus: new FormControl('REPORTED', { nonNullable: true, validators: [Validators.required] }),
    professionalInspectionReceived: new FormControl(false, { nonNullable: true }),
    evacuated: new FormControl(false, { nonNullable: true }),
    displacedPeopleReported: new FormControl(false, { nonNullable: true }),
    reason: new FormControl('Actualización desde ficha técnica.', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
  protected readonly structureDescriptionForm: StructureDescriptionForm = new FormGroup({
    referenceText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(500)],
    }),
    reason: new FormControl('Actualización de descripción desde ficha técnica.', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });
  protected readonly reliefCreateForm: ReliefCreateForm = new FormGroup({
    addressText: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(180)] }),
    countryName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    internationalAddressText: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    contactPhone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
  });
  protected readonly reliefSupplyControl = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] });
  protected readonly reliefSupplyNeeds = signal<string[]>([]);
  protected readonly reliefPhotoDrafts = signal<Array<TechnicalFilePhotoDraft | null>>([null, null, null]);
  protected readonly needItemControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.restoreStoredSession();
  }

  ngAfterViewInit(): void {
    this.subscriptions.add(this.searchControl.valueChanges.subscribe((value) => this.searchTerm.set(value)));
    this.subscriptions.add(this.reportForm.controls.addressText.valueChanges.subscribe((value) => this.reportAddressTerm.set(value)));
    this.subscriptions.add(this.reliefCreateForm.controls.addressText.valueChanges.subscribe((value) => this.reliefAddressTerm.set(value)));

    this.map = L.map('earth-control-map', {
      zoomControl: false,
      attributionControl: true,
    }).setView([this.selectedPoint().latitude, this.selectedPoint().longitude], 12);

    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '(C) OpenStreetMap contributors',
    });
    this.streetLayer.on('tileload', (event: L.TileEvent) => this.styleStreetTile(event.tile));
    this.streetLayer.addTo(this.map);

    this.satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles (C) Esri',
      },
    );

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.zoneLayer.addTo(this.map);
    this.structureLayer.addTo(this.map);
    this.reliefLayer.addTo(this.map);
    this.seismicLayer.addTo(this.map);
    this.referenceLayer.addTo(this.map);
    this.positionLayer.addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.setSelectedPoint({ longitude: event.latlng.lng, latitude: event.latlng.lat }, false);
      if (this.locationEditMode() && this.selectedTechnicalFile()) {
        this.statusMessage.set(`Punto propuesto seleccionado: ${this.formatPoint(this.selectedPoint())}.`);
      }
    });

    this.map.on('zoomend', () => this.renderReferenceLayer());

    setTimeout(() => this.map?.invalidateSize(), 0);
    if (this.isMobileViewport()) {
      this.panelCollapsed.set(true);
    }
    this.loadNearby();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.previewCloseTimer) {
      window.clearTimeout(this.previewCloseTimer);
    }
    this.clearSessionExpiryTimer();
    this.map?.remove();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.syncMobileViewport();
    this.map?.invalidateSize();
  }

  protected setActiveModule(
    module: ModuleKey,
    options: { preserveReliefCreate?: boolean; preserveTechnicalFile?: boolean } = {},
  ): void {
    this.activeModule.set(module);
    this.drawerOpen.set(false);
    this.mobileMapToolsOpen.set(false);
    this.mobileHelpToolsOpen.set(false);
    this.mobileLegendOpen.set(false);
    this.panelCollapsed.set(false);
    this.summaryCollapsed.set(false);
    if (!options.preserveReliefCreate) {
      this.reliefCreateMode.set(null);
    }
    if (!options.preserveTechnicalFile) {
      this.closeTechnicalFile();
    }
    this.renderLayers();
    if (module === 'aprobar') {
      this.loadModerationQueue();
    }
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected toggleSummary(): void {
    if (this.isMobileViewport()) {
      this.panelCollapsed.update((collapsed) => !collapsed);
      return;
    }
    this.summaryCollapsed.update((collapsed) => !collapsed);
  }

  protected toggleMobileMapTools(): void {
    this.mobileMapToolsOpen.update((open) => !open);
    this.mobileHelpToolsOpen.set(false);
  }

  protected toggleMobileHelpTools(): void {
    this.mobileHelpToolsOpen.update((open) => !open);
    this.mobileMapToolsOpen.set(false);
  }

  protected t(key: string): string {
    return this.copy[this.language()][key] ?? this.copy.es[key] ?? key;
  }

  protected setLanguage(language: Language): void {
    this.language.set(language);
    this.statusMessage.set(language === 'es' ? 'Interfaz cambiada a español.' : 'Interface switched to English.');
  }

  protected dismissNotice(): void {
    this.noticeVisible.set(false);
    try {
      window.localStorage.setItem('earthcontrol.notice.v1', 'dismissed');
    } catch {
      // Ignore private browsing storage restrictions.
    }
  }

  protected openReportGuide(): void {
    this.reportGuideOpen.set(true);
  }

  protected closeReportGuide(): void {
    this.reportGuideOpen.set(false);
  }

  protected openBuildingSummary(): void {
    this.buildingSummaryOpen.set(true);
  }

  protected closeBuildingSummary(): void {
    this.buildingSummaryOpen.set(false);
  }

  protected openCollectionCenterSummary(): void {
    this.collectionCenterSummaryOpen.set(true);
  }

  protected closeCollectionCenterSummary(): void {
    this.collectionCenterSummaryOpen.set(false);
  }

  protected openMobileLegend(): void {
    this.mobileMapToolsOpen.set(false);
    this.mobileHelpToolsOpen.set(false);
    this.mobileLegendOpen.set(true);
  }

  protected closeMobileLegend(): void {
    this.mobileLegendOpen.set(false);
  }

  protected openModerationHistory(kind: ModerationHistoryKind): void {
    this.moderationHistoryModal.set(kind);
  }

  protected closeModerationHistory(): void {
    this.moderationHistoryModal.set(null);
  }

  protected toggleRegistrationForm(): void {
    this.registrationFormOpen.update((open) => !open);
  }

  protected moduleLabel(module: ModuleKey): string {
    return this.t(`module.${module}`);
  }

  protected compactModuleLabel(module: ModuleKey): string {
    const labels: Partial<Record<ModuleKey, string>> = {
      'refugios-personas': 'Ref. Personas',
      'refugios-animales': 'Ref. Animales',
      'numeros-emergencia': 'Emergencias',
      'centros-acopio': 'Acopio',
      'mapa-cartografico': 'Cartografía',
      'terminos-uso': 'Términos',
      'mapas-dano': 'Mapa Daño',
      aprobar: 'Aprobar',
    };
    return labels[module] || this.moduleLabel(module);
  }

  protected drawerItemLabel(item: DrawerItem): string {
    if (item.key === 'add-acopio') {
      return this.t('drawer.add-acopio');
    }
    if (item.key === 'add-refugio-personas') {
      return this.t('drawer.add-refugio-personas');
    }
    if (item.key === 'add-refugio-animales') {
      return this.t('drawer.add-refugio-animales');
    }
    return this.moduleLabel(item.key);
  }

  protected reportGuideSteps(): Array<{ icon: string; title: string; description: string }> {
    if (this.language() === 'en') {
      return [
        {
          icon: 'photo_camera',
          title: 'What information helps',
          description: 'Report affected buildings, active shelters, supply centers, blocked access, visible damage, or urgent needs.',
        },
        {
          icon: 'place',
          title: 'Locate the point',
          description: 'Use GPS, the map center, or a nearby reference. Add city, sector, parish, and a clear landmark when possible.',
        },
        {
          icon: 'schedule',
          title: 'Protect yourself',
          description: 'Do not enter damaged structures or restricted areas to confirm information. Report only what you can observe safely.',
        },
        {
          icon: 'privacy_tip',
          title: 'Review before publishing',
          description: 'Anonymous reports, photos, needs, location changes, and removals go through moderation before becoming public.',
        },
      ];
    }

    return [
      {
        icon: 'photo_camera',
        title: 'Qué información ayuda',
        description: 'Reporta edificaciones afectadas, refugios activos, centros de acopio, accesos bloqueados, daños visibles o necesidades urgentes.',
      },
      {
        icon: 'place',
        title: 'Ubica el punto',
        description: 'Usa GPS, el centro del mapa o una referencia cercana. Agrega ciudad, sector, parroquia y un punto de referencia claro cuando sea posible.',
      },
      {
        icon: 'schedule',
        title: 'Cuida tu seguridad',
        description: 'No entres a estructuras dañadas ni zonas restringidas para confirmar datos. Reporta sólo lo que puedas observar de forma segura.',
      },
      {
        icon: 'privacy_tip',
        title: 'Revisión antes de publicar',
        description: 'Reportes anónimos, fotos, insumos, cambios de ubicación y retiros pasan por moderación antes de quedar públicos.',
      },
    ];
  }

  protected termsSections(): Array<{ icon: string; title: string; body: string; items: string[] }> {
    if (this.language() === 'en') {
      return [
        {
          icon: 'info',
          title: 'About the platform',
          body: 'DondeAyudoVenezuela does not replace official authorities or professional structural assessments. It organizes community-supported information so people can understand affected areas and available help points.',
          items: [
            'Information may change as reports are reviewed.',
            'Critical decisions must be confirmed with competent authorities.',
          ],
        },
        {
          icon: 'verified_user',
          title: 'Acceptable use',
          body: 'Use the platform to consult, report, and support verified community information.',
          items: [
            'Do not submit false, defamatory, or unsafe information.',
            'Do not publish personal data from third parties without consent.',
            'Do not use the service for misleading commercial or illegal purposes.',
          ],
        },
        {
          icon: 'database',
          title: 'Data use and scraping',
          body: 'Mass scraping, automated extraction, mirroring, or redistribution of reports, photos, lists, and metadata is not allowed without explicit permission.',
          items: [
            'Individual consultation by real people is allowed.',
            'Structured access can be evaluated for humanitarian, rescue, academic, media, or public-interest work.',
          ],
        },
        {
          icon: 'groups',
          title: 'Community moderation',
          body: 'Anonymous contributions and proposed changes can be approved, rejected, edited, or removed by moderators to protect data quality and public safety.',
          items: [
            'Photos, supply needs, location changes, and removal requests enter a review queue.',
            'Moderator and administrator accounts require prior approval.',
          ],
        },
      ];
    }

    return [
      {
        icon: 'info',
        title: 'Sobre la plataforma',
        body: 'DondeAyudoVenezuela no reemplaza a las autoridades oficiales ni a evaluaciones profesionales de estructura. Organiza información apoyada por la comunidad para entender zonas afectadas y puntos de ayuda disponibles.',
        items: [
          'La información puede cambiar a medida que los reportes se revisan.',
          'Las decisiones críticas deben confirmarse con autoridades competentes.',
        ],
      },
      {
        icon: 'verified_user',
        title: 'Uso aceptable',
        body: 'Usa la plataforma para consultar, reportar y apoyar información comunitaria verificable.',
        items: [
          'No envíes información falsa, difamatoria o que ponga personas en riesgo.',
          'No publiques datos personales de terceros sin consentimiento.',
          'No uses el servicio para fines comerciales engañosos o ilícitos.',
        ],
      },
      {
        icon: 'database',
        title: 'Uso de datos y scraping',
        body: 'No se permite scraping masivo, extracción automatizada, mirroring o redistribución de reportes, fotografías, listados y metadatos sin permiso explícito.',
        items: [
          'La consulta individual por personas reales está permitida.',
          'El acceso estructurado puede evaluarse para trabajo humanitario, rescate, académico, periodístico o de interés público.',
        ],
      },
      {
        icon: 'groups',
        title: 'Moderación comunitaria',
        body: 'Los aportes anónimos y cambios propuestos pueden ser aprobados, rechazados, editados o retirados por moderadores para proteger la calidad de datos y la seguridad pública.',
        items: [
          'Fotos, insumos, cambios de ubicación y solicitudes de eliminación entran en una cola de revisión.',
          'Las cuentas de moderadores y administradores requieren aprobación previa.',
        ],
      },
    ];
  }

  protected scrollTopModules(direction: -1 | 1): void {
    const scroller = this.moduleScroller?.nativeElement;
    if (!scroller) {
      return;
    }
    scroller.scrollBy({
      left: direction * Math.max(240, scroller.clientWidth * 0.65),
      behavior: 'smooth',
    });
  }

  protected selectDrawerItem(item: DrawerItem): void {
    if (item.requiresAuth && !this.isAuthenticated()) {
      this.drawerOpen.set(false);
      this.statusMessage.set('Inicia sesión en Perfil para usar esta opción.');
      this.setActiveModule('perfil');
      return;
    }

    if (item.key === 'add-acopio' || item.key === 'add-refugio-personas' || item.key === 'add-refugio-animales') {
      this.drawerOpen.set(false);
      const createType =
        item.key === 'add-acopio' ? 'COLLECTION_CENTER' : item.key === 'add-refugio-animales' ? 'ANIMAL_SHELTER' : 'SHELTER';
      this.openReliefCreateForm(createType);
      return;
    }

    this.setActiveModule(item.key);
  }

  protected locateUser(): void {
    this.errorMessage.set(null);
    if (!navigator.geolocation) {
      this.errorMessage.set('Geolocalización no disponible en este navegador.');
      return;
    }

    this.loading.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        this.setSelectedPoint(point, true);
        this.loadNearby(point);
      },
      () => {
        this.loading.set(false);
        this.errorMessage.set('No se pudo obtener la ubicación GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  protected refresh(): void {
    this.loadNearby();
    if (this.activeModule() === 'aprobar') {
      this.loadModerationQueue();
    }
  }

  protected useMapCenter(): void {
    const center = this.map?.getCenter();
    if (!center) {
      return;
    }
    this.setSelectedPoint({ longitude: center.lng, latitude: center.lat }, false);
    this.loadNearby();
  }

  protected toggleMapMode(): void {
    if (!this.map || !this.streetLayer || !this.satelliteLayer) {
      return;
    }

    const next = this.mapMode() === 'map' ? 'satellite' : 'map';
    if (next === 'satellite') {
      if (this.map.hasLayer(this.streetLayer)) {
        this.map.removeLayer(this.streetLayer);
      }
      this.satelliteLayer.addTo(this.map);
    } else {
      if (this.map.hasLayer(this.satelliteLayer)) {
        this.map.removeLayer(this.satelliteLayer);
      }
      this.streetLayer.addTo(this.map);
    }
    this.mapMode.set(next);
  }

  protected runSearch(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const term = this.normalize(this.searchControl.value);
    if (!term) {
      return;
    }

    this.errorMessage.set(null);
    const match = this.searchSuggestions()[0] ?? this.findBestSearchMatch(term);
    if (!match) {
      this.statusMessage.set('No se ha ubicado una coincidencia en los datos cargados.');
      return;
    }

    this.selectSearchSuggestion(match);
  }

  protected selectSearchSuggestion(match: SearchSuggestion): void {
    this.searchControl.setValue(match.label);
    this.setActiveModule(match.module);
    this.setSelectedPoint(match.point, true);
    if (match.structure) {
      this.selectStructure(match.structure, false);
    } else if (match.reliefCenter) {
      this.selectReliefCenter(match.reliefCenter, false);
    }
    this.statusMessage.set(`Ubicación encontrada: ${match.label}.`);
  }

  protected selectAddressSuggestion(match: SearchSuggestion, target: 'report' | 'relief'): void {
    const detail = this.suggestionDisplayDetail(match);
    const label = detail ? `${match.label} - ${detail}` : match.label;
    if (target === 'report') {
      this.reportForm.controls.addressText.setValue(label);
    } else {
      this.reliefCreateForm.controls.addressText.setValue(label);
    }
    const point = this.proposedPointForAddressReference(match, target);
    this.setSelectedPoint(point, true, 17);
    this.statusMessage.set(this.referenceSelectionMessage(match));
  }

  protected suggestionDisplayDetail(suggestion: SearchSuggestion): string {
    if (!suggestion.referencePoint) {
      return suggestion.detail;
    }
    return suggestion.detail.replace(/^Referencia\s+[^·]+·\s*/i, '').trim();
  }

  protected suggestionTooltip(suggestion: SearchSuggestion): string {
    return [suggestion.label, suggestion.detail].filter(Boolean).join(' - ');
  }

  protected resolveReportAddress(silent = false): void {
    this.resolveAddressReference(this.reportForm.controls.addressText.value, 'report', silent);
  }

  protected resolveReliefAddress(silent = false): void {
    this.resolveAddressReference(this.reliefCreateForm.controls.addressText.value, 'relief', silent);
  }

  protected addReportSupplyNeed(): void {
    const next = this.nextInlineNeedList(this.reportSupplyControl.value, this.reportSupplyNeeds());
    if (!next) {
      return;
    }
    this.reportSupplyNeeds.set(next);
    this.reportSupplyControl.setValue('');
  }

  protected removeReportSupplyNeed(index: number): void {
    this.reportSupplyNeeds.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  protected addReliefSupplyNeed(): void {
    const next = this.nextInlineNeedList(this.reliefSupplyControl.value, this.reliefSupplyNeeds());
    if (!next) {
      return;
    }
    this.reliefSupplyNeeds.set(next);
    this.reliefSupplyControl.setValue('');
  }

  protected removeReliefSupplyNeed(index: number): void {
    this.reliefSupplyNeeds.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  protected draftPhotoForSlot(target: 'report' | 'relief', slot: number): TechnicalFilePhotoDraft | null {
    return (target === 'report' ? this.reportPhotoDrafts() : this.reliefPhotoDrafts())[slot] ?? null;
  }

  protected submitDraftPhoto(event: Event, target: 'report' | 'relief', slot: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'image_not_supported',
        title: 'Archivo no válido',
        message: 'Selecciona una imagen para la ficha técnica.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        this.showFeedbackDialog({
          tone: 'warning',
          icon: 'image_not_supported',
          title: 'Imagen no válida',
          message: 'No pude preparar la imagen seleccionada.',
        });
        return;
      }
      this.assignPhotoDraft(target, slot, {
        fileName: file.name || `foto-${slot + 1}`,
        fileType: file.type || 'image/jpeg',
        dataUrl,
        caption: `Foto inicial ${slot + 1}`,
      });
    };
    reader.onerror = () => {
      this.showFeedbackDialog({
        tone: 'danger',
        icon: 'error',
        title: 'No se pudo leer',
        message: 'No pude cargar la imagen seleccionada. Intenta con otra foto.',
      });
    };
    reader.readAsDataURL(file);
  }

  protected clearDraftPhoto(target: 'report' | 'relief', slot: number): void {
    this.assignPhotoDraft(target, slot, null);
  }

  private assignPhotoDraft(target: 'report' | 'relief', slot: number, photo: TechnicalFilePhotoDraft | null): void {
    const updater = (items: Array<TechnicalFilePhotoDraft | null>) => {
      const next = [...items];
      next[slot] = photo;
      return next;
    };
    if (target === 'report') {
      this.reportPhotoDrafts.update(updater);
      return;
    }
    this.reliefPhotoDrafts.update(updater);
  }

  private compactPhotoDrafts(photos: Array<TechnicalFilePhotoDraft | null>): TechnicalFilePhotoDraft[] {
    return photos.filter((photo): photo is TechnicalFilePhotoDraft => photo !== null).slice(0, 3);
  }

  protected submitReport(): void {
    this.errorMessage.set(null);
    this.lastIntakeId.set(null);
    this.consumeReportSupplyDraft();
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'warning_amber',
        title: 'Campos incompletos',
        message: 'Completa la dirección o referencia, el nombre de la edificación y una descripción mínima antes de enviar.',
      });
      return;
    }

    const value = this.reportForm.getRawValue();
    const supplyNeeds = this.reportSupplyNeeds();
    const description = this.buildReportDescription(value, supplyNeeds);
    const payload: PublicIntakeReportRequest = {
      reporterDisplayName: null,
      reporterContact: null,
      structureName: this.emptyToNull(value.structureName),
      addressText: this.emptyToNull(value.addressText),
      location: this.selectedPoint(),
      description,
      professionalInspectionReceived: value.professionalInspectionReceived,
      evacuated: value.evacuated,
      displacedPeopleReported: value.displacedPeopleReported,
      supplyNeeds,
      photos: this.compactPhotoDrafts(this.reportPhotoDrafts()),
    };

    this.openSubmitConfirmation({
      title: 'Confirmar reporte de edificación',
      message: this.canModerate()
        ? 'La edificación se publicará directamente en el mapa.'
        : 'El reporte será enviado a aprobación antes de publicarse.',
      details: [
        { label: 'Edificación', value: payload.structureName || 'Edificación reportada' },
        { label: 'Referencia', value: payload.addressText || 'Sin referencia' },
        { label: 'Ubicación', value: this.formatPoint(payload.location) },
        { label: 'Flujo', value: this.canModerate() ? 'Publicación directa' : 'Requiere aprobación' },
        { label: 'Detalle', value: this.truncateForDialog(payload.description) },
      ],
      onConfirm: () => this.submitReportAfterConfirmation(payload),
    });
  }

  private submitReportAfterConfirmation(payload: PublicIntakeReportRequest): void {
    const credentials = this.credentials();
    if (credentials && this.canModerate()) {
      this.createStructureFromReport(payload, credentials);
      return;
    }

    this.submitting.set(true);
    const request = this.api.submitIntakeReport(payload).subscribe({
      next: (report) => {
        this.submitting.set(false);
        this.lastIntakeId.set(report.id);
        this.statusMessage.set('Reporte ciudadano enviado.');
        this.resetReportForm();
        this.showFeedbackDialog({
          tone: 'success',
          icon: 'check_circle',
          title: 'Reporte enviado',
          message: 'Tu reporte fue enviado. Pasará por aprobación antes de publicarse.',
          eyebrow: 'Gracias por aportar',
        });
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('No se pudo enviar el reporte ciudadano.');
        this.showFeedbackDialog({
          tone: 'danger',
          icon: 'error',
          title: 'No se pudo enviar',
          message: 'No pude enviar el reporte ciudadano. Inténtalo nuevamente en unos minutos.',
          eyebrow: 'Error',
        });
      },
    });
    this.subscriptions.add(request);
  }

  private createStructureFromReport(payload: PublicIntakeReportRequest, credentials: BasicAuthCredentials): void {
    const structurePayload: StructureCreateRequest = {
      name: payload.structureName?.trim() || 'Edificación reportada',
      structureType: 'BUILDING',
      addressText: payload.addressText || null,
      referenceText: payload.description,
      location: payload.location,
      currentDamageLevel: 'UNKNOWN',
      currentSeverity: 'MEDIUM',
      currentOperationalStatus: 'PENDING_ASSESSMENT',
      verificationStatus: 'REPORTED',
      publicVisible: true,
    };

    this.submitting.set(true);
    const request = this.api.createStructure(structurePayload, credentials).subscribe({
      next: (structure) => {
        this.applyInitialStructureStatus(structure, payload, credentials);
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('No se pudo publicar la edificación directamente.');
        this.showFeedbackDialog({
          tone: 'danger',
          icon: 'error',
          title: 'No se pudo publicar',
          message: 'No pude publicar la edificación directamente con la sesión actual.',
          eyebrow: 'Error',
        });
      },
    });
    this.subscriptions.add(request);
  }

  private applyInitialStructureStatus(
    structure: Structure,
    payload: PublicIntakeReportRequest,
    credentials: BasicAuthCredentials,
  ): void {
    const requiresStatusUpdate =
      Boolean(payload.professionalInspectionReceived) ||
      Boolean(payload.evacuated) ||
      Boolean(payload.displacedPeopleReported);

    if (!requiresStatusUpdate) {
      this.finishDirectStructurePublication(structure, payload.supplyNeeds ?? [], payload.photos ?? [], credentials);
      return;
    }

    const statusPayload: StructureStatusUpdateRequest = {
      currentDamageLevel: structure.currentDamageLevel || 'UNKNOWN',
      currentSeverity: structure.currentSeverity || 'MEDIUM',
      currentOperationalStatus: structure.currentOperationalStatus || 'PENDING_ASSESSMENT',
      verificationStatus: structure.verificationStatus || 'REPORTED',
      professionalInspectionReceived: Boolean(payload.professionalInspectionReceived),
      evacuated: Boolean(payload.evacuated),
      displacedPeopleReported: Boolean(payload.displacedPeopleReported),
      publicVisible: true,
      reason: 'Publicación directa desde Reportar Edificación.',
    };

    const request = this.api.updateStructureStatus(structure.id, statusPayload, credentials).subscribe({
      next: (updated) => this.finishDirectStructurePublication(updated, payload.supplyNeeds ?? [], payload.photos ?? [], credentials),
      error: () => this.finishDirectStructurePublication(structure, payload.supplyNeeds ?? [], payload.photos ?? [], credentials),
    });
    this.subscriptions.add(request);
  }

  private finishDirectStructurePublication(
    structure: Structure,
    supplyNeeds: string[],
    photos: TechnicalFilePhotoDraft[],
    credentials: BasicAuthCredentials,
  ): void {
    this.submitting.set(false);
    this.lastIntakeId.set(null);
    this.structures.update((items) => [structure, ...items.filter((item) => item.id !== structure.id)]);
    this.renderLayers();
    this.resetReportForm();
    this.statusMessage.set(`Edificación publicada directamente: ${structure.name}.`);
    this.selectStructure(structure);
    this.createInitialSupplyNeeds({ structureId: structure.id, reliefCenterId: null }, supplyNeeds, credentials);
    this.createInitialPhotos({ structureId: structure.id, reliefCenterId: null }, photos, credentials);
    this.showFeedbackDialog({
      tone: 'success',
      icon: 'check_circle',
      title: 'Edificación publicada',
      message: `${structure.name} ya está visible en el mapa operativo.`,
      eyebrow: 'Publicación directa',
    });
  }

  private consumeReportSupplyDraft(): void {
    const draft = this.reportSupplyControl.value.trim();
    if (!draft) {
      return;
    }
    const next = this.nextInlineNeedList(draft, this.reportSupplyNeeds(), { silent: true });
    if (next) {
      this.reportSupplyNeeds.set(next);
      this.reportSupplyControl.setValue('');
    }
  }

  private consumeReliefSupplyDraft(): void {
    const draft = this.reliefSupplyControl.value.trim();
    if (!draft) {
      return;
    }
    const next = this.nextInlineNeedList(draft, this.reliefSupplyNeeds(), { silent: true });
    if (next) {
      this.reliefSupplyNeeds.set(next);
      this.reliefSupplyControl.setValue('');
    }
  }

  private nextInlineNeedList(rawValue: string, current: string[], options: { silent?: boolean } = {}): string[] | null {
    const item = rawValue.trim();
    if (!item) {
      if (!options.silent) {
        this.showFeedbackDialog({
          tone: 'warning',
          icon: 'warning_amber',
          title: 'Insumo vacío',
          message: 'Escribe el insumo o necesidad antes de añadirlo.',
        });
      }
      return null;
    }
    if (current.length >= 5) {
      if (!options.silent) {
        this.showFeedbackDialog({
          tone: 'warning',
          icon: 'production_quantity_limits',
          title: 'Límite alcanzado',
          message: 'Puedes registrar un máximo de 5 necesidades por ficha.',
        });
      }
      return null;
    }
    const exists = current.some((need) => this.normalize(need) === this.normalize(item));
    if (exists) {
      if (!options.silent) {
        this.showFeedbackDialog({
          tone: 'warning',
          icon: 'content_copy',
          title: 'Insumo duplicado',
          message: 'Ese insumo ya está en la lista.',
        });
      }
      return null;
    }
    return [...current, item];
  }

  private buildReportDescription(value: ReportForm['value'], supplyNeeds: string[]): string {
    const lines = [
      `Situación observada: ${value.description?.trim() || 'Sin detalle'}`,
      `Dirección o referencia: ${value.addressText?.trim() || 'Sin referencia'}`,
      `Inspección profesional: ${value.professionalInspectionReceived ? 'Sí' : 'No'}`,
      `Desalojado: ${value.evacuated ? 'Sí' : 'No'}`,
      `Damnificados en la zona: ${value.displacedPeopleReported ? 'Sí' : 'No'}`,
    ];

    if (supplyNeeds.length > 0) {
      lines.push(`Necesidades o insumos reportados: ${supplyNeeds.join(', ')}`);
    }

    return lines.join('\n');
  }

  private resetReportForm(): void {
    this.reportForm.reset({
      addressText: '',
      structureName: '',
      description: '',
      professionalInspectionReceived: false,
      evacuated: false,
      displacedPeopleReported: false,
    });
    this.reportSupplyControl.setValue('');
    this.reportSupplyNeeds.set([]);
    this.reportPhotoDrafts.set([null, null, null]);
  }

  private createInitialSupplyNeeds(
    target: { structureId: number | null; reliefCenterId: number | null },
    supplyNeeds: string[],
    credentials: BasicAuthCredentials,
  ): void {
    const uniqueNeeds = [...new Set(supplyNeeds.map((need) => need.trim()).filter(Boolean))].slice(0, 5);
    if (uniqueNeeds.length === 0) {
      return;
    }

    const request = forkJoin(
      uniqueNeeds.map((itemName) =>
        this.api.createSupplyNeed(
          {
            ...target,
            itemName,
            category: 'OTHER',
            urgency: 'MEDIUM',
            notes: 'Necesidad inicial registrada desde formulario de reporte.',
          },
          credentials,
        ),
      ),
    ).subscribe({
      next: () => {
        const file = this.selectedTechnicalFile();
        if (file) {
          this.reloadTechnicalFile(file);
        }
        this.statusMessage.set('Insumos iniciales registrados en la ficha técnica.');
      },
      error: () => {
        this.errorMessage.set('El punto se publicó, pero no pude registrar todos los insumos iniciales.');
      },
    });
    this.subscriptions.add(request);
  }

  private createInitialPhotos(
    target: { structureId: number | null; reliefCenterId: number | null },
    photos: TechnicalFilePhotoDraft[],
    credentials: BasicAuthCredentials,
  ): void {
    const photoDrafts = photos.slice(0, 3);
    if (photoDrafts.length === 0) {
      return;
    }

    const request = forkJoin(
      photoDrafts.map((photo) =>
        this.api.publishTechnicalFilePhoto(
          {
            ...target,
            fileName: photo.fileName,
            fileType: photo.fileType,
            dataUrl: photo.dataUrl,
            caption: photo.caption ?? null,
          },
          credentials,
        ),
      ),
    ).subscribe({
      next: () => {
        const file = this.selectedTechnicalFile();
        if (file) {
          this.reloadTechnicalFile(file);
        }
        this.statusMessage.set('Fotos iniciales registradas en la ficha técnica.');
      },
      error: () => {
        this.errorMessage.set('El punto se publicó, pero no pude registrar todas las fotos iniciales.');
      },
    });
    this.subscriptions.add(request);
  }

  protected confirmSubmitDialog(): void {
    const dialog = this.submitConfirmation();
    this.submitConfirmation.set(null);
    dialog?.onConfirm();
  }

  protected cancelSubmitDialog(): void {
    this.submitConfirmation.set(null);
  }

  private openSubmitConfirmation(dialog: SubmitConfirmationDialog): void {
    const request = this.dialog.open(AppFeedbackDialog, {
      width: 'min(440px, 92vw)',
      panelClass: 'earth-feedback-dialog-panel',
      data: {
        tone: 'info',
        icon: dialog.icon || 'fact_check',
        eyebrow: dialog.eyebrow || 'Validación previa',
        title: dialog.title,
        message: dialog.message,
        details: dialog.details,
        confirmText: dialog.confirmText || 'Sí, enviar',
        cancelText: dialog.cancelText || 'No, revisar',
      } satisfies AppFeedbackDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        dialog.onConfirm();
      }
    });
    this.subscriptions.add(request);
  }

  private showFeedbackDialog(data: Omit<AppFeedbackDialogData, 'confirmText'> & { confirmText?: string }): void {
    this.dialog.open(AppFeedbackDialog, {
      width: 'min(440px, 92vw)',
      panelClass: 'earth-feedback-dialog-panel',
      data: {
        confirmText: 'Aceptar',
        ...data,
      } satisfies AppFeedbackDialogData,
    });
  }

  private resolveAddressReference(rawValue: string, target: 'report' | 'relief', silent = false): void {
    const value = rawValue.trim();
    if (!value) {
      if (!silent) {
        this.showFeedbackDialog({
          tone: 'warning',
          icon: 'warning_amber',
          title: 'Referencia requerida',
          message: 'Escribe una dirección, sector o punto de referencia para ubicar el punto en el mapa.',
        });
      }
      return;
    }

    const match = this.findBestSearchMatch(value);
    if (!match) {
      if (!silent) {
        this.showFeedbackDialog({
          tone: 'warning',
          icon: 'travel_explore',
          title: 'Referencia no encontrada',
          message: 'No encontré esa referencia en la base local. Puedes ajustar el punto manualmente haciendo clic en el mapa.',
        });
      }
      return;
    }

    const point = this.proposedPointForAddressReference(match, target);
    this.setSelectedPoint(point, true, 17);
    this.searchControl.setValue(match.label);
    this.statusMessage.set(this.referenceSelectionMessage(match));
  }

  private truncateForDialog(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 160) {
      return normalized;
    }
    return `${normalized.slice(0, 157)}...`;
  }

  protected submitContactSuggestion(): void {
    this.contactMessage.set(null);
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'warning_amber',
        title: 'Mensaje incompleto',
        message: 'Escribe una sugerencia o mensaje de al menos 12 caracteres antes de enviarlo.',
      });
      return;
    }

    const value = this.contactForm.getRawValue();
    this.contactSubmitting.set(true);
    const request = this.api.submitContactSuggestion({
      senderName: value.senderName.trim() || null,
      senderEmail: value.senderEmail.trim() || null,
      messageBody: value.messageBody.trim(),
    }).subscribe({
      next: (response) => {
        this.contactSubmitting.set(false);
        this.contactMessage.set('Sugerencia enviada. Gracias por colaborar.');
        this.contactForm.reset({ senderName: '', senderEmail: '', messageBody: '' });
        this.showFeedbackDialog({
          tone: 'success',
          icon: 'check_circle',
          title: 'Sugerencia enviada',
          message: 'Tu mensaje fue enviado. Gracias por ayudar a mejorar la plataforma.',
          eyebrow: 'Contacto',
        });
      },
      error: () => {
        this.contactSubmitting.set(false);
        this.contactMessage.set('No pude enviar la sugerencia. Inténtalo nuevamente más tarde.');
        this.showFeedbackDialog({
          tone: 'danger',
          icon: 'error',
          title: 'No se pudo enviar',
          message: 'No pude enviar la sugerencia. Inténtalo nuevamente más tarde.',
          eyebrow: 'Error',
        });
      },
    });
    this.subscriptions.add(request);
  }

  protected checkRegistrationUsername(): void {
    const username = this.registrationForm.controls.username.value.trim().toLowerCase();
    this.usernameAvailabilityMessage.set(null);
    if (this.registrationForm.controls.username.invalid) {
      return;
    }

    const request = this.api.checkUsernameAvailability(username).subscribe({
      next: (result) => {
        this.usernameAvailabilityMessage.set(result.available ? 'Usuario disponible.' : 'Ese usuario ya existe.');
      },
      error: () => {
        this.usernameAvailabilityMessage.set('No pude validar el usuario en este momento.');
      },
    });
    this.subscriptions.add(request);
  }

  protected submitRegistration(): void {
    this.registrationMessage.set(null);
    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      return;
    }
    const value = this.registrationForm.getRawValue();
    if (value.password !== value.repeatPassword) {
      this.registrationMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.registrationSubmitting.set(true);
    const request = this.api.checkUsernameAvailability(value.username.trim().toLowerCase()).subscribe({
      next: (availability) => {
        if (!availability.available) {
          this.registrationSubmitting.set(false);
          this.registrationMessage.set('Ese usuario ya existe.');
          return;
        }
        this.createRegistration();
      },
      error: () => {
        this.registrationSubmitting.set(false);
        this.registrationMessage.set('No pude validar el usuario. Inténtalo nuevamente.');
      },
    });
    this.subscriptions.add(request);
  }

  private createRegistration(): void {
    const value = this.registrationForm.getRawValue();
    const request = this.api.registerUser({
      username: value.username.trim().toLowerCase(),
      password: value.password,
      email: value.email.trim().toLowerCase(),
      fullName: value.fullName.trim(),
    }).subscribe({
      next: (registration) => {
        this.registrationSubmitting.set(false);
        this.registrationMessage.set('Registro enviado. Un administrador debe aprobarlo.');
        this.usernameAvailabilityMessage.set(null);
        this.registrationForm.reset({
          username: '',
          password: '',
          repeatPassword: '',
          email: '',
          fullName: '',
        });
      },
      error: () => {
        this.registrationSubmitting.set(false);
        this.registrationMessage.set('No se ha podido enviar el registro. Por favor comprobar que el usuario y correo no existan previamente.');
      },
    });
    this.subscriptions.add(request);
  }

  protected saveProfile(): void {
    this.adminErrorMessage.set(null);
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'warning_amber',
        title: 'Credenciales requeridas',
        message: 'Indica usuario y clave para iniciar sesión como moderador o administrador.',
      });
      return;
    }

    const value = this.authForm.getRawValue();
    const username = value.username.trim();
    this.adminLoading.set(true);
    const request = this.api.login({ username, password: value.password }).subscribe({
      next: (response) => {
        this.adminLoading.set(false);
        const credentials: BasicAuthCredentials = {
          username: response.user.username,
          token: response.token,
          expiresAt: response.expiresAt,
        };
        this.activateSession(credentials, response.user);
        this.authForm.patchValue({ password: '' });
        this.statusMessage.set(`Sesión operativa activa para ${response.user.fullName || response.user.username}.`);
        this.showFeedbackDialog({
          tone: 'success',
          icon: 'verified_user',
          title: 'Sesión iniciada',
          message: `Bienvenido, ${response.user.fullName || response.user.username}. Tu sesión operativa está activa por 1 hora.`,
          eyebrow: 'Perfil',
        });
        this.setActiveModule('aprobar');
      },
      error: () => {
        this.adminLoading.set(false);
        this.endSession();
        this.adminErrorMessage.set('No se ha podido iniciar sesión. Por favor comprobar usuario y contraseña ingresados...');
        this.showFeedbackDialog({
          tone: 'danger',
          icon: 'lock',
          title: 'No se pudo iniciar sesión',
          message: 'Por favor comprobar usuario y contraseña ingresados...',
          eyebrow: 'Perfil',
        });
      },
    });
    this.subscriptions.add(request);
  }

  protected clearProfile(): void {
    this.endSession('Sesión operativa cerrada.');
  }

  protected openPasswordDialog(): void {
    this.passwordChangeForm.reset({ currentPassword: '', password: '', repeatPassword: '' });
    this.passwordDialogOpen.set(true);
  }

  protected closePasswordDialog(): void {
    if (this.passwordChanging()) {
      return;
    }
    this.passwordDialogOpen.set(false);
    this.passwordChangeForm.reset({ currentPassword: '', password: '', repeatPassword: '' });
  }

  protected submitPasswordChange(): void {
    const credentials = this.requireCredentials();
    if (!credentials || !this.canModerate()) {
      return;
    }
    if (this.passwordChangeForm.invalid) {
      this.passwordChangeForm.markAllAsTouched();
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'password',
        title: 'Campos incompletos',
        message: 'Indica la contraseña actual y la nueva contraseña con al menos 8 caracteres.',
      });
      return;
    }

    const value = this.passwordChangeForm.getRawValue();
    if (value.password !== value.repeatPassword) {
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'sync_problem',
        title: 'Contraseñas distintas',
        message: 'La nueva contraseña y su confirmación deben coincidir.',
      });
      return;
    }
    if (value.currentPassword === value.password) {
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'lock_reset',
        title: 'Contraseña sin cambios',
        message: 'Indica una contraseña nueva distinta a la actual.',
      });
      return;
    }

    this.passwordChanging.set(true);
    const request = this.api.updateCurrentUserPassword({
      currentPassword: value.currentPassword,
      password: value.password,
    }, credentials).subscribe({
      next: () => {
        this.passwordChanging.set(false);
        this.passwordDialogOpen.set(false);
        this.passwordChangeForm.reset({ currentPassword: '', password: '', repeatPassword: '' });
        this.endSession('Contraseña actualizada. Inicia sesión nuevamente con tu nueva contraseña.');
        this.setActiveModule('perfil');
        this.showFeedbackDialog({
          tone: 'success',
          icon: 'verified_user',
          title: 'Contraseña actualizada',
          message: 'La sesión se cerró por seguridad. Inicia sesión nuevamente con tu nueva contraseña.',
          eyebrow: 'Perfil',
        });
      },
      error: () => {
        this.passwordChanging.set(false);
        this.showFeedbackDialog({
          tone: 'danger',
          icon: 'lock',
          title: 'No se pudo cambiar',
          message: 'Verifica que la contraseña actual sea correcta e intenta nuevamente.',
          eyebrow: 'Perfil',
        });
      },
    });
    this.subscriptions.add(request);
  }

  protected sessionExpirationLabel(): string {
    const expiresAt = this.credentials()?.expiresAt;
    if (!expiresAt) {
      return 'Sin vencimiento registrado';
    }
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(expiresAt));
  }

  private activateSession(credentials: BasicAuthCredentials, user: CurrentUser): void {
    if (this.isCredentialsExpired(credentials)) {
      this.endSession('La sesión operativa venció. Inicia sesión nuevamente.');
      return;
    }
    this.credentials.set(credentials);
    this.currentUser.set(user);
    this.authForm.patchValue({ username: user.username, password: '' });
    this.persistSession(credentials, user);
    this.scheduleSessionExpiration(credentials);
  }

  private endSession(statusMessage?: string): void {
    this.clearStoredSession();
    this.clearSessionExpiryTimer();
    this.credentials.set(null);
    this.currentUser.set(null);
    this.intakeReports.set([]);
    this.technicalFileChanges.set([]);
    this.userRegistrations.set([]);
    this.authForm.patchValue({ password: '' });
    this.adminErrorMessage.set(null);
    if (statusMessage) {
      this.statusMessage.set(statusMessage);
    }
  }

  private restoreStoredSession(): void {
    let storedSession: StoredSession | null = null;
    try {
      const raw = window.localStorage.getItem(this.sessionStorageKey);
      storedSession = raw ? JSON.parse(raw) as StoredSession : null;
    } catch {
      this.clearStoredSession();
      return;
    }

    if (!storedSession?.credentials?.token || !storedSession.credentials.expiresAt || !storedSession.user?.username) {
      this.clearStoredSession();
      return;
    }
    if (this.isCredentialsExpired(storedSession.credentials)) {
      this.endSession('La sesión operativa venció. Inicia sesión nuevamente.');
      return;
    }

    const restoredSession = storedSession;
    this.credentials.set(restoredSession.credentials);
    this.currentUser.set(restoredSession.user);
    this.authForm.patchValue({ username: restoredSession.user.username, password: '' });
    this.scheduleSessionExpiration(restoredSession.credentials);

    const request = this.api.findCurrentUser(restoredSession.credentials).subscribe({
      next: (user) => {
        this.activateSession(restoredSession.credentials, user);
      },
      error: () => {
        this.endSession('La sesión guardada ya no es válida. Inicia sesión nuevamente.');
      },
    });
    this.subscriptions.add(request);
  }

  private persistSession(credentials: BasicAuthCredentials, user: CurrentUser): void {
    try {
      const payload: StoredSession = { credentials, user };
      window.localStorage.setItem(this.sessionStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore private browsing storage restrictions.
    }
  }

  private clearStoredSession(): void {
    try {
      window.localStorage.removeItem(this.sessionStorageKey);
    } catch {
      // Ignore private browsing storage restrictions.
    }
  }

  private scheduleSessionExpiration(credentials: BasicAuthCredentials): void {
    this.clearSessionExpiryTimer();
    if (!credentials.expiresAt) {
      return;
    }
    const delay = new Date(credentials.expiresAt).getTime() - Date.now();
    if (delay <= 0) {
      this.endSession('La sesión operativa venció. Inicia sesión nuevamente.');
      return;
    }
    this.sessionExpiryTimer = window.setTimeout(() => {
      this.endSession('La sesión operativa venció. Inicia sesión nuevamente.');
      if (this.activeModule() === 'aprobar') {
        this.setActiveModule('perfil');
      }
    }, delay);
  }

  private clearSessionExpiryTimer(): void {
    if (this.sessionExpiryTimer) {
      window.clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = undefined;
    }
  }

  private isCredentialsExpired(credentials: BasicAuthCredentials): boolean {
    if (!credentials.expiresAt) {
      return false;
    }
    return new Date(credentials.expiresAt).getTime() <= Date.now();
  }

  protected loadModerationQueue(): void {
    const credentials = this.requireCredentials();
    if (!credentials) {
      return;
    }

    this.loadIntakeReports(credentials);
    this.loadTechnicalFileChanges(credentials);
    if (this.isAdmin()) {
      this.loadUserRegistrations(credentials);
    }
  }

  protected loadIntakeReports(credentials = this.requireCredentials()): void {
    if (!credentials) {
      return;
    }

    this.adminLoading.set(true);
    this.adminErrorMessage.set(null);
    const request = this.api.findBackofficeIntakeReports(null, 50, credentials).subscribe({
      next: (reports) => {
        this.adminLoading.set(false);
        this.intakeReports.set(reports);
      },
      error: () => {
        this.adminLoading.set(false);
        this.adminErrorMessage.set('No pude consultar el backoffice. Revisa usuario, clave y backend.');
      },
    });
    this.subscriptions.add(request);
  }

  protected loadTechnicalFileChanges(credentials = this.requireCredentials()): void {
    if (!credentials) {
      return;
    }

    const request = this.api.findBackofficeTechnicalFileChanges('PENDING', 50, credentials).subscribe({
      next: (changes) => {
        this.technicalFileChanges.set(changes);
      },
      error: () => {
        this.adminErrorMessage.set('No pude consultar los cambios de fichas pendientes.');
      },
    });
    this.subscriptions.add(request);
  }

  protected loadUserRegistrations(credentials = this.requireCredentials()): void {
    if (!credentials || !this.isAdmin()) {
      return;
    }

    const request = this.api.findUserRegistrations(credentials).subscribe({
      next: (registrations) => {
        this.userRegistrations.set(registrations);
      },
      error: () => {
        this.adminErrorMessage.set('No pude consultar los registros de usuarios pendientes.');
      },
    });
    this.subscriptions.add(request);
  }

  protected approveUserRegistration(registration: UserRegistration): void {
    this.reviewUserRegistration(registration, true);
  }

  protected rejectUserRegistration(registration: UserRegistration): void {
    this.reviewUserRegistration(registration, false);
  }

  protected markReportInReview(report: BackofficeIntakeReport): void {
    this.openSubmitConfirmation({
      title: `Revisar reporte #${report.id}`,
      message: 'Valida la información recibida antes de tomar este reporte para revisión.',
      details: this.buildBackofficeReportDetails(report),
      confirmText: 'Aceptar revisión',
      cancelText: 'Volver',
      eyebrow: 'Vista previa',
      icon: 'fact_check',
      onConfirm: () => this.reviewReport(report, 'IN_REVIEW', 'Tomado para revisión desde DondeAyudoVenezuela.'),
    });
  }

  protected rejectReport(report: BackofficeIntakeReport): void {
    this.reviewReport(report, 'REJECTED', 'Rechazado desde panel MVP.');
  }

  protected selectStructure(structure: Structure, moveMap = true): void {
    this.reliefCreateMode.set(null);
    this.panelCollapsed.set(false);
    this.closeMapPreview();
    this.setSelectedPoint(structure.location, moveMap);
    this.technicalFileLoading.set(true);
    const request = this.api.findStructureTechnicalFile(structure.id).subscribe({
      next: (file) => {
        this.technicalFileLoading.set(false);
        this.selectedTechnicalFile.set(file);
        if (file.structure) {
          this.populateStructureEditForm(file.structure);
          this.populateStructureDescriptionForm(file.structure);
        }
      },
      error: () => {
        this.technicalFileLoading.set(false);
        this.errorMessage.set('No pude abrir la ficha técnica del edificio.');
      },
    });
    this.subscriptions.add(request);
  }

  protected selectReliefCenter(center: ReliefCenter, moveMap = true): void {
    this.reliefCreateMode.set(null);
    this.panelCollapsed.set(false);
    this.closeMapPreview();
    if (center.location) {
      this.setSelectedPoint(center.location, moveMap);
    }
    this.technicalFileLoading.set(true);
    const request = this.api.findReliefCenterTechnicalFile(center.id).subscribe({
      next: (file) => {
        this.technicalFileLoading.set(false);
        this.selectedTechnicalFile.set(file);
      },
      error: () => {
        this.technicalFileLoading.set(false);
        this.errorMessage.set('No pude abrir la ficha técnica del refugio.');
      },
    });
    this.subscriptions.add(request);
  }

  protected closeTechnicalFile(): void {
    this.selectedTechnicalFile.set(null);
    this.needItemControl.setValue('');
    this.locationEditMode.set(false);
    this.structureDescriptionEditMode.set(false);
  }

  protected openReliefCreateForm(type: ReliefCreateType): void {
    this.reliefCreateMode.set(type);
    this.resetReliefCreateForm();
    this.setActiveModule(
      type === 'COLLECTION_CENTER' ? 'centros-acopio' : type === 'ANIMAL_SHELTER' ? 'refugios-animales' : 'refugios-personas',
      { preserveReliefCreate: true },
    );
  }

  protected setDonationScope(scope: DonationScope): void {
    this.donationScope.set(scope);
    this.syncReliefCreateValidators();
    this.closeTechnicalFile();
    this.renderLayers();
  }

  protected isInternationalReliefCreate(): boolean {
    return this.reliefCreateMode() === 'COLLECTION_CENTER' && this.donationScope() === 'international';
  }

  protected cancelReliefCreate(): void {
    this.reliefCreateMode.set(null);
    this.resetReliefCreateForm();
  }

  protected reliefCreateTitle(): string {
    const mode = this.reliefCreateMode();
    return mode ? `Añadir ${this.reliefCreateLabels[mode]}` : 'Añadir punto de apoyo';
  }

  protected submitReliefCenter(): void {
    const mode = this.reliefCreateMode();
    if (!mode) {
      return;
    }
    this.consumeReliefSupplyDraft();
    const rawValue = this.reliefCreateForm.getRawValue();
    const international = this.isInternationalReliefCreate();
    const missingNationalReference = !international && !rawValue.addressText.trim();
    const missingInternationalReference = international
      && (!rawValue.countryName.trim() || !rawValue.internationalAddressText.trim());
    if (this.reliefCreateForm.invalid || missingNationalReference || missingInternationalReference) {
      this.reliefCreateForm.markAllAsTouched();
      this.showFeedbackDialog({
        tone: 'warning',
        icon: 'warning_amber',
        title: 'Campos incompletos',
        message: international
          ? 'Completa el país, la dirección referencial y el nombre del centro internacional antes de enviarlo.'
          : 'Completa la dirección o referencia y el nombre del punto de apoyo antes de enviarlo.',
      });
      return;
    }

    const payload = this.reliefCreatePayload(mode);
    this.openSubmitConfirmation({
      title: `Confirmar ${this.reliefCreateLabels[mode]}`,
      message: this.canModerate()
        ? 'El punto de apoyo se publicará directamente en el mapa.'
        : 'El punto de apoyo será enviado a aprobación antes de publicarse.',
      details: [
        { label: 'Tipo', value: this.reliefCreateLabels[mode] },
        { label: 'Nombre', value: payload.name },
        { label: 'Referencia', value: payload.international ? `${payload.countryName} · ${payload.internationalAddressText}` : (payload.addressText || 'Sin referencia') },
        { label: 'Ubicación', value: payload.location ? this.formatPoint(payload.location) : 'Sin ubicación en mapa' },
        { label: 'Flujo', value: this.canModerate() ? 'Publicación directa' : 'Requiere aprobación' },
        { label: 'Detalle', value: this.truncateForDialog(payload.description || payload.addressText || 'Sin detalle adicional') },
      ],
      onConfirm: () => this.submitReliefCenterAfterConfirmation(payload),
    });
  }

  private submitReliefCenterAfterConfirmation(payload: ReliefCenterCreateRequest): void {
    const credentials = this.credentials();
    this.reliefSubmitting.set(true);
    this.errorMessage.set(null);

    if (credentials && this.canModerate()) {
      const initialNeeds = this.reliefSupplyNeeds();
      const request = this.api.createReliefCenter(payload, credentials).subscribe({
        next: (created) => {
          this.reliefSubmitting.set(false);
          this.cancelReliefCreate();
          this.reliefCenters.update((centers) => [created, ...centers]);
          this.renderLayers();
          this.selectReliefCenter(created);
          this.createInitialSupplyNeeds({ structureId: null, reliefCenterId: created.id }, initialNeeds, credentials);
          this.statusMessage.set(`${this.formatEnum(created.centerType)} publicado: ${created.name}.`);
          this.showFeedbackDialog({
            tone: 'success',
            icon: 'check_circle',
            title: 'Punto publicado',
            message: created.international
              ? `${created.name} ya está disponible en la lista internacional.`
              : `${created.name} ya está visible en el mapa operativo.`,
            eyebrow: 'Publicación directa',
          });
        },
        error: () => {
          this.reliefSubmitting.set(false);
          this.errorMessage.set('No pude crear el refugio o centro de acopio con la sesión actual.');
          this.showFeedbackDialog({
            tone: 'danger',
            icon: 'error',
            title: 'No se pudo publicar',
            message: 'No pude crear el refugio o centro de acopio con la sesión actual.',
            eyebrow: 'Error',
          });
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitReliefCenterCreateChange(payload).subscribe({
      next: (change) => {
        this.reliefSubmitting.set(false);
        this.cancelReliefCreate();
        this.statusMessage.set('Solicitud enviada a aprobación.');
        this.showFeedbackDialog({
          tone: 'success',
          icon: 'check_circle',
          title: 'Solicitud enviada',
          message: 'Tu solicitud fue enviada. Pasará por aprobación antes de publicarse.',
          eyebrow: 'Gracias por aportar',
        });
      },
      error: () => {
        this.reliefSubmitting.set(false);
        this.errorMessage.set('No pude enviar la solicitud a aprobación.');
        this.showFeedbackDialog({
          tone: 'danger',
          icon: 'error',
          title: 'No se pudo enviar',
          message: 'No pude enviar la solicitud a aprobación. Inténtalo nuevamente en unos minutos.',
          eyebrow: 'Error',
        });
      },
    });
    this.subscriptions.add(request);
  }

  protected submitStructureStatusUpdate(): void {
    const file = this.selectedTechnicalFile();
    const structure = file?.structure;
    const credentials = this.credentials();
    if (!structure || !credentials || !this.canModerate()) {
      return;
    }
    if (this.structureEditForm.invalid) {
      this.structureEditForm.markAllAsTouched();
      return;
    }

    const value = this.structureEditForm.getRawValue();
    const payload: StructureStatusUpdateRequest = {
      currentDamageLevel: value.currentDamageLevel,
      currentSeverity: value.currentSeverity,
      currentOperationalStatus: value.currentOperationalStatus,
      verificationStatus: value.verificationStatus,
      professionalInspectionReceived: value.professionalInspectionReceived,
      evacuated: value.evacuated,
      displacedPeopleReported: value.displacedPeopleReported,
      publicVisible: true,
      reason: value.reason,
    };
    this.structureStatusSubmitting.set(true);
    const request = this.api.updateStructureStatus(structure.id, payload, credentials).subscribe({
      next: (updated) => {
        this.structureStatusSubmitting.set(false);
        this.selectedTechnicalFile.set({ ...file, structure: updated });
        this.structures.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.reloadTechnicalFile({ ...file, structure: updated });
        this.statusMessage.set(`Ficha actualizada: ${updated.name}.`);
      },
      error: () => {
        this.structureStatusSubmitting.set(false);
        this.errorMessage.set('No pude actualizar los campos del edificio.');
      },
    });
    this.subscriptions.add(request);
  }

  private reliefCreatePayload(type: ReliefCreateType): ReliefCenterCreateRequest {
    const value = this.reliefCreateForm.getRawValue();
    const supplyNeeds = this.reliefSupplyNeeds();
    const international = this.isInternationalReliefCreate();
    const supplyDetail = supplyNeeds.length ? `Insumos o recursos: ${supplyNeeds.join(', ')}` : 'Sin insumos específicos reportados.';
    const phoneDetail = value.contactPhone.trim() ? `Teléfono reportado: ${value.contactPhone.trim()}` : 'Sin teléfono reportado.';
    const referenceDetail = international
      ? `País: ${value.countryName.trim()}. Dirección referencial: ${value.internationalAddressText.trim()}.`
      : `Referencia nacional: ${value.addressText.trim() || 'Sin referencia'}.`;
    return {
      name: value.name.trim(),
      description: `${this.reliefCreateLabels[type]} reportado desde formulario comunitario. ${referenceDetail} ${supplyDetail}`,
      centerType: type,
      location: international ? null : this.selectedPoint(),
      addressText: international ? null : (value.addressText.trim() || null),
      contactPhone: value.contactPhone.trim() || null,
      contactNotes: `${phoneDetail} ${supplyDetail}`,
      acceptsPeople: type === 'SHELTER',
      acceptsAnimals: type === 'ANIMAL_SHELTER',
      acceptsDonations: type === 'COLLECTION_CENTER',
      submitterDisplayName: null,
      submitterContact: null,
      publicVisible: true,
      international,
      countryName: international ? value.countryName.trim() : null,
      internationalAddressText: international ? value.internationalAddressText.trim() : null,
      photos: this.compactPhotoDrafts(this.reliefPhotoDrafts()),
    };
  }

  private resetReliefCreateForm(): void {
    this.reliefCreateForm.reset({
      addressText: '',
      name: '',
      countryName: '',
      internationalAddressText: '',
      contactPhone: '',
    });
    this.syncReliefCreateValidators();
    this.reliefSupplyControl.setValue('');
    this.reliefSupplyNeeds.set([]);
    this.reliefPhotoDrafts.set([null, null, null]);
  }

  private syncReliefCreateValidators(): void {
    const international = this.isInternationalReliefCreate();
    this.reliefCreateForm.controls.addressText.setValidators(
      international ? [Validators.maxLength(500)] : [Validators.required, Validators.maxLength(500)],
    );
    this.reliefCreateForm.controls.countryName.setValidators(
      international ? [Validators.required, Validators.maxLength(120)] : [Validators.maxLength(120)],
    );
    this.reliefCreateForm.controls.internationalAddressText.setValidators(
      international ? [Validators.required, Validators.maxLength(500)] : [Validators.maxLength(500)],
    );
    this.reliefCreateForm.controls.addressText.updateValueAndValidity({ emitEvent: false });
    this.reliefCreateForm.controls.countryName.updateValueAndValidity({ emitEvent: false });
    this.reliefCreateForm.controls.internationalAddressText.updateValueAndValidity({ emitEvent: false });
  }

  private populateStructureEditForm(structure: Structure): void {
    this.structureEditForm.setValue({
      currentDamageLevel: structure.currentDamageLevel || 'UNKNOWN',
      currentSeverity: structure.currentSeverity || 'MEDIUM',
      currentOperationalStatus: structure.currentOperationalStatus || 'PENDING_ASSESSMENT',
      verificationStatus: structure.verificationStatus || 'REPORTED',
      professionalInspectionReceived: Boolean(structure.professionalInspectionReceived),
      evacuated: Boolean(structure.evacuated),
      displacedPeopleReported: Boolean(structure.displacedPeopleReported),
      reason: 'Actualización desde ficha técnica.',
    });
  }

  protected structureDescriptionText(structure: Structure): string {
    return structure.referenceText || structure.sourceSummary || 'Sin descripción ampliada.';
  }

  protected startStructureDescriptionEdit(structure: Structure): void {
    this.populateStructureDescriptionForm(structure);
    this.structureDescriptionEditMode.set(true);
  }

  protected cancelStructureDescriptionEdit(): void {
    const structure = this.selectedTechnicalFile()?.structure;
    if (structure) {
      this.populateStructureDescriptionForm(structure);
    }
    this.structureDescriptionEditMode.set(false);
  }

  protected submitStructureDescriptionUpdate(): void {
    const file = this.selectedTechnicalFile();
    const structure = file?.structure;
    const credentials = this.credentials();
    if (!structure || !credentials || !this.canModerate()) {
      return;
    }
    if (this.structureDescriptionForm.invalid) {
      this.structureDescriptionForm.markAllAsTouched();
      return;
    }

    const value = this.structureDescriptionForm.getRawValue();
    const payload: StructureDescriptionUpdateRequest = {
      referenceText: value.referenceText.trim(),
      reason: value.reason.trim() || 'Actualización de descripción desde ficha técnica.',
    };

    this.structureDescriptionSubmitting.set(true);
    const request = this.api.updateStructureDescription(structure.id, payload, credentials).subscribe({
      next: (updated) => {
        this.structureDescriptionSubmitting.set(false);
        this.structureDescriptionEditMode.set(false);
        this.selectedTechnicalFile.set({ ...file, structure: updated });
        this.structures.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.statusMessage.set(`Descripción actualizada: ${updated.name}.`);
      },
      error: () => {
        this.structureDescriptionSubmitting.set(false);
        this.errorMessage.set('No pude actualizar la descripción del edificio.');
      },
    });
    this.subscriptions.add(request);
  }

  private populateStructureDescriptionForm(structure: Structure): void {
    this.structureDescriptionForm.setValue({
      referenceText: this.structureDescriptionText(structure),
      reason: 'Actualización de descripción desde ficha técnica.',
    });
  }

  protected addSupplyNeed(): void {
    const file = this.selectedTechnicalFile();
    const itemName = this.needItemControl.value.trim();
    if (!file || !itemName) {
      return;
    }

    const target = this.supplyNeedTarget(file);
    const payload = {
      ...target,
      itemName,
      category: 'OTHER',
      urgency: 'MEDIUM',
    };

    const credentials = this.credentials();
    if (credentials && this.canModerate()) {
      const request = this.api.createSupplyNeed(payload, credentials).subscribe({
        next: () => {
          this.needItemControl.setValue('');
          this.reloadTechnicalFile(file);
          this.statusMessage.set('Insumo publicado directamente en la ficha técnica.');
        },
        error: () => {
          this.errorMessage.set('No pude publicar el insumo. Revisa el límite de 5 necesidades.');
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitTechnicalFileSupplyNeedChange(payload).subscribe({
      next: (change) => {
        this.needItemControl.setValue('');
        this.statusMessage.set('Insumo enviado a aprobación.');
        this.showContributionDialog();
      },
      error: () => {
        this.errorMessage.set('No pude enviar el insumo a aprobación. Revisa el límite de 5 necesidades.');
      },
    });
    this.subscriptions.add(request);
  }

  protected editSupplyNeed(need: SupplyNeedSummary): void {
    const file = this.selectedTechnicalFile();
    if (!file || this.supplyNeedSubmittingId() === need.id) {
      return;
    }

    const itemName = window.prompt('Editar insumo', need.itemName)?.trim();
    if (!itemName || itemName === need.itemName) {
      return;
    }

    const payload = this.supplyNeedUpdatePayload(need, itemName);
    const credentials = this.credentials();
    this.supplyNeedSubmittingId.set(need.id);

    if (credentials && this.canModerate()) {
      const request = this.api.updateSupplyNeed(need.id, payload, credentials).subscribe({
        next: () => {
          this.supplyNeedSubmittingId.set(null);
          this.reloadTechnicalFile(file);
          this.statusMessage.set('Insumo actualizado directamente en la ficha técnica.');
        },
        error: () => {
          this.supplyNeedSubmittingId.set(null);
          this.errorMessage.set('No pude actualizar el insumo.');
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitTechnicalFileSupplyNeedUpdateChange({
      ...this.supplyNeedTarget(file),
      supplyNeedId: need.id,
      ...payload,
    }).subscribe({
      next: (change) => {
        this.supplyNeedSubmittingId.set(null);
        this.statusMessage.set('Edición de insumo enviada a aprobación.');
        this.showContributionDialog();
      },
      error: () => {
        this.supplyNeedSubmittingId.set(null);
        this.errorMessage.set('No pude enviar la edición del insumo a aprobación.');
      },
    });
    this.subscriptions.add(request);
  }

  protected deleteSupplyNeed(need: SupplyNeedSummary): void {
    const file = this.selectedTechnicalFile();
    if (!file || this.supplyNeedSubmittingId() === need.id) {
      return;
    }
    if (!window.confirm(`Eliminar el insumo "${need.itemName}" de esta ficha técnica?`)) {
      return;
    }

    const credentials = this.credentials();
    this.supplyNeedSubmittingId.set(need.id);

    if (credentials && this.canModerate()) {
      const request = this.api.deleteSupplyNeed(need.id, credentials).subscribe({
        next: () => {
          this.supplyNeedSubmittingId.set(null);
          this.reloadTechnicalFile(file);
          this.statusMessage.set('Insumo retirado directamente de la ficha técnica.');
        },
        error: () => {
          this.supplyNeedSubmittingId.set(null);
          this.errorMessage.set('No pude retirar el insumo.');
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitTechnicalFileSupplyNeedDeleteChange({
      ...this.supplyNeedTarget(file),
      supplyNeedId: need.id,
      reason: `Retiro solicitado para insumo: ${need.itemName}.`,
    }).subscribe({
      next: (change) => {
        this.supplyNeedSubmittingId.set(null);
        this.statusMessage.set('Retiro de insumo enviado a aprobación.');
        this.showContributionDialog();
      },
      error: () => {
        this.supplyNeedSubmittingId.set(null);
        this.errorMessage.set('No pude enviar el retiro del insumo a aprobación.');
      },
    });
    this.subscriptions.add(request);
  }

  private supplyNeedTarget(file: TechnicalFile): { structureId: number | null; reliefCenterId: number | null } {
    return {
      structureId: file.structure?.id ?? null,
      reliefCenterId: file.reliefCenter?.id ?? null,
    };
  }

  private supplyNeedUpdatePayload(need: SupplyNeedSummary, itemName: string): SupplyNeedUpdateRequest {
    return {
      itemName,
      category: need.category || 'OTHER',
      urgency: need.urgency || 'MEDIUM',
      requestedQuantity: need.requestedQuantity ?? null,
      unit: need.unit ?? null,
      notes: need.notes ?? null,
    };
  }

  protected photoForSlot(file: TechnicalFile, slot: number): { fileUrl: string; caption?: string } | null {
    return file.photos[slot] ?? null;
  }

  protected openPhotoUpload(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  protected openPhotoPreview(url: string, caption?: string): void {
    this.photoPreview.set({ url, caption: caption || this.selectedFileTitle() });
  }

  protected closePhotoPreview(): void {
    this.photoPreview.set(null);
  }

  protected closeContributionDialog(): void {
    this.contributionDialogMessage.set(null);
  }

  private showContributionDialog(): void {
    this.contributionDialogMessage.set('Recurso enviado para aprobación, ¡gracias por su aporte!');
  }

  protected submitPhotoChange(event: Event): void {
    const fileState = this.selectedTechnicalFile();
    const input = event.target as HTMLInputElement;
    const photo = input.files?.[0];
    if (!fileState || !photo) {
      return;
    }
    if (!photo.type.startsWith('image/')) {
      this.errorMessage.set('Selecciona una imagen válida.');
      return;
    }
    if (photo.size > 1500000) {
      this.errorMessage.set('La imagen debe pesar máximo 1.5 MB para esta versión MVP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const payload = {
        structureId: fileState.structure?.id ?? null,
        reliefCenterId: fileState.reliefCenter?.id ?? null,
        fileName: photo.name,
        fileType: photo.type,
        dataUrl: String(reader.result),
        caption: `Aporte ciudadano para ${this.selectedFileTitle()}`,
      };
      const credentials = this.credentials();
      if (credentials) {
        const request = this.api.publishTechnicalFilePhoto(payload, credentials).subscribe({
          next: (updatedFile) => {
            this.selectedTechnicalFile.set(updatedFile);
            this.statusMessage.set('Foto publicada directamente en la ficha técnica.');
          },
          error: () => {
            this.errorMessage.set('No pude publicar la foto. Revisa el límite de 3 fotos.');
          },
        });
        this.subscriptions.add(request);
        return;
      }
      const request = this.api.submitTechnicalFilePhotoChange(payload).subscribe({
        next: (change) => {
          this.statusMessage.set('Foto enviada a aprobación.');
          this.showContributionDialog();
        },
        error: () => {
          this.errorMessage.set('No pude enviar la foto a aprobación. Revisa el límite de 3 fotos.');
        },
      });
      this.subscriptions.add(request);
    };
    reader.readAsDataURL(photo);
  }

  protected copyContact(contact: EmergencyContact): void {
    const value = contact.contactValue;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => this.statusMessage.set(`Copiado: ${value}`),
        () => this.copyContactFallback(value),
      );
      return;
    }

    this.copyContactFallback(value);
  }

  protected contactHref(contact: EmergencyContact): string {
    const phone = contact.contactValue.replace(/[^\d+*#]/g, '');
    return `tel:${phone || contact.contactValue}`;
  }

  protected startLocationChange(): void {
    const file = this.selectedTechnicalFile();
    if (!file) {
      return;
    }
    this.locationEditMode.set(true);
    this.statusMessage.set('Haz clic en el mapa para seleccionar la nueva ubicación y luego confirma el cambio.');
  }

  protected submitLocationChange(): void {
    const file = this.selectedTechnicalFile();
    if (!file) {
      return;
    }

    const point = this.selectedPoint();
    const payload = {
      structureId: file.structure?.id ?? null,
      reliefCenterId: file.reliefCenter?.id ?? null,
      location: point,
      note: `Cambio de ubicación propuesto desde ficha técnica para ${this.selectedFileTitle()}.`,
    };
    const credentials = this.credentials();
    this.locationSubmitting.set(true);
    this.errorMessage.set(null);

    if (credentials) {
      const request = this.api.updateTechnicalFileLocation(payload, credentials).subscribe({
        next: (updatedFile) => {
          this.locationSubmitting.set(false);
          this.locationEditMode.set(false);
          this.selectedTechnicalFile.set(updatedFile);
          this.setSelectedPoint(point, true);
          this.loadNearby();
          this.statusMessage.set(`Ubicación actualizada directamente: ${this.formatPoint(point)}.`);
        },
        error: () => {
          this.locationSubmitting.set(false);
          this.errorMessage.set('No pude actualizar la ubicación con la sesión operativa actual.');
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitTechnicalFileLocationChange(payload).subscribe({
      next: (change) => {
        this.locationSubmitting.set(false);
        this.locationEditMode.set(false);
        this.statusMessage.set('Ubicación enviada a aprobación.');
      },
      error: () => {
        this.locationSubmitting.set(false);
        this.errorMessage.set('No pude enviar la nueva ubicación a aprobación.');
      },
    });
    this.subscriptions.add(request);
  }

  protected submitDeleteChange(): void {
    const file = this.selectedTechnicalFile();
    if (!file) {
      return;
    }

    const confirmed = window.confirm(
      this.isAuthenticated() ? this.t('delete.confirm.direct') : this.t('delete.confirm.review'),
    );
    if (!confirmed) {
      return;
    }

    const payload = {
      structureId: file.structure?.id ?? null,
      reliefCenterId: file.reliefCenter?.id ?? null,
      reason: `Solicitud de retiro desde ficha técnica para ${this.selectedFileTitle()}.`,
    };
    const credentials = this.credentials();
    this.deleteSubmitting.set(true);
    this.errorMessage.set(null);

    if (credentials) {
      const request = this.api.deleteTechnicalFile(payload, credentials).subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.statusMessage.set(`${this.t('delete.approved')}: ${this.selectedFileTitle()}.`);
          this.closeTechnicalFile();
          this.loadNearby();
        },
        error: () => {
          this.deleteSubmitting.set(false);
          this.errorMessage.set('No pude retirar el punto con la sesión operativa actual.');
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitTechnicalFileDeleteChange(payload).subscribe({
      next: (change) => {
        this.deleteSubmitting.set(false);
        this.statusMessage.set(`${this.t('delete.pending')}.`);
      },
      error: () => {
        this.deleteSubmitting.set(false);
        this.errorMessage.set('No pude enviar la solicitud de eliminación a aprobación.');
      },
    });
    this.subscriptions.add(request);
  }

  protected structureLocationLabel(structure: Structure): string {
    return this.locationLabel(
      [structure.addressText, structure.parishName, structure.municipalityName, structure.stateName],
      'Ubicación referencial',
    );
  }

  protected reliefLocationLabel(center: ReliefCenter): string {
    if (center.international) {
      return this.locationLabel(
        [center.countryName, center.internationalAddressText],
        'Centro internacional sin ubicación en mapa',
      );
    }
    return this.locationLabel(
      [center.addressText, center.parishName, center.municipalityName, center.stateName],
      'Ubicación referencial',
    );
  }

  protected openCartographicModal(): void {
    this.cartographicModalOpen.set(true);
  }

  protected closeCartographicModal(): void {
    this.cartographicModalOpen.set(false);
  }

  protected keepMapPreview(): void {
    if (this.previewCloseTimer) {
      window.clearTimeout(this.previewCloseTimer);
      this.previewCloseTimer = undefined;
    }
  }

  protected scheduleCloseMapPreview(): void {
    this.keepMapPreview();
    this.previewCloseTimer = window.setTimeout(() => this.mapPreview.set(null), 240);
  }

  protected closeMapPreview(): void {
    this.keepMapPreview();
    this.mapPreview.set(null);
  }

  protected openPreviewFile(preview: MapPreview): void {
    if (preview.structure) {
      this.selectStructure(preview.structure);
      return;
    }
    if (preview.reliefCenter) {
      this.selectReliefCenter(preview.reliefCenter);
    }
  }

  private copyContactFallback(value: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    this.statusMessage.set(copied ? `Copiado: ${value}` : `Número: ${value}`);
  }

  protected approveReport(report: BackofficeIntakeReport): void {
    const credentials = this.requireCredentials();
    if (!credentials) {
      return;
    }

    this.moderatingReportId.set(report.id);
    this.adminErrorMessage.set(null);
    const structurePayload: StructureCreateRequest = {
      name: report.structureName?.trim() || `Reporte ciudadano #${report.id}`,
      structureType: 'BUILDING',
      addressText: null,
      referenceText: report.description,
      location: report.location,
      currentDamageLevel: 'UNKNOWN',
      currentSeverity: 'MEDIUM',
      currentOperationalStatus: 'PENDING_ASSESSMENT',
      verificationStatus: 'VERIFIED',
      publicVisible: true,
    };
    const request = this.api.createStructure(structurePayload, credentials).subscribe({
      next: (structure) => {
        const convertRequest = this.api.convertIntakeReport(
          report.id,
          {
            structureId: structure.id,
            sourceType: 'CITIZEN',
            location: report.location,
            accuracyMeters: report.accuracyMeters ?? null,
            damageLevel: 'UNKNOWN',
            severity: 'MEDIUM',
            operationalStatus: 'PENDING_ASSESSMENT',
            verificationStatus: 'VERIFIED',
            survivorStatus: 'UNKNOWN',
            assistanceStatus: 'UNKNOWN',
            description: report.description,
            moderatorNotes: 'Publicado desde panel de aprobación MVP.',
            publicVisible: true,
          },
          credentials,
        ).subscribe({
          next: (updated) => {
            this.moderatingReportId.set(null);
            this.structures.update((items) => [structure, ...items.filter((item) => item.id !== structure.id)]);
            this.renderLayers();
            this.statusMessage.set(`Reporte ${report.id} aprobado y convertido.`);
            this.intakeReports.update((items) => items.map((item) => item.id === report.id ? updated : item));
            this.addReportHistory(report, 'APPROVED', 'Aprobado y convertido en edificación.');
            this.loadIntakeReports();
          },
          error: () => {
            this.moderatingReportId.set(null);
            this.adminErrorMessage.set('La edificación se creó, pero no pude convertir el reporte seleccionado.');
          },
        });
        this.subscriptions.add(convertRequest);
      },
      error: () => {
        this.moderatingReportId.set(null);
        this.adminErrorMessage.set('No pude crear la edificación del reporte seleccionado.');
      },
    });
    this.subscriptions.add(request);
  }

  protected approveTechnicalFileChange(change: TechnicalFileChange): void {
    if (change.changeType === 'CREATE_RELIEF_CENTER') {
      this.openSubmitConfirmation({
        title: `Revisar ${this.changeTargetName(change)}`,
        message: 'Valida la información del punto de apoyo antes de aprobarlo y publicarlo.',
        details: this.buildCreateReliefCenterChangeDetails(change),
        confirmText: 'Aprobar',
        cancelText: 'Volver',
        eyebrow: 'Vista previa',
        icon: 'add_location_alt',
        onConfirm: () => this.reviewTechnicalFileChange(change, true),
      });
      return;
    }
    this.reviewTechnicalFileChange(change, true);
  }

  protected rejectTechnicalFileChange(change: TechnicalFileChange): void {
    this.reviewTechnicalFileChange(change, false);
  }

  protected changePayloadText(change: TechnicalFileChange, key: string): string {
    const value = change.proposedPayload[key];
    return value === null || value === undefined ? '' : String(value);
  }

  protected changeTargetName(change: TechnicalFileChange): string {
    if (change.changeType === 'CREATE_RELIEF_CENTER') {
      return this.changePayloadText(change, 'name') || 'Nuevo punto de apoyo';
    }
    return change.structureName || change.reliefCenterName || 'Ficha técnica';
  }

  protected changeTypeLabel(change: TechnicalFileChange): string {
    if (change.changeType === 'PHOTO') {
      return this.t('change.photo');
    }
    if (change.changeType === 'LOCATION') {
      return this.t('change.location');
    }
    if (change.changeType === 'DELETE') {
      return this.t('change.delete');
    }
    if (change.changeType === 'CREATE_RELIEF_CENTER') {
      return 'Nuevo refugio/acopio';
    }
    return this.t('change.supply');
  }

  protected changeDeleteText(change: TechnicalFileChange): string {
    return this.changePayloadText(change, 'reason') || 'Solicitud de retiro de la capa pública.';
  }

  protected changeLocationText(change: TechnicalFileChange): string {
    const point = this.changePayloadPoint(change);
    const note = this.changePayloadText(change, 'note');
    const label = point ? this.formatPoint(point) : 'Coordenadas incompletas';
    return note ? `${label} - ${note}` : label;
  }

  protected changePayloadPhotos(change: TechnicalFileChange): TechnicalFilePhotoDraft[] {
    const photos = change.proposedPayload['photos'];
    if (!Array.isArray(photos)) {
      return [];
    }
    return photos
      .filter((photo): photo is TechnicalFilePhotoDraft =>
        Boolean(photo)
        && typeof photo === 'object'
        && 'dataUrl' in photo
        && typeof (photo as TechnicalFilePhotoDraft).dataUrl === 'string',
      )
      .slice(0, 3);
  }

  private buildBackofficeReportDetails(report: BackofficeIntakeReport): Array<{ label: string; value: string }> {
    const photoCount = report.photoCount ?? 0;
    const details = [
      { label: 'Tipo', value: 'Edificación afectada' },
      { label: 'Edificación', value: report.structureName?.trim() || `Reporte ciudadano #${report.id}` },
      {
        label: 'Sector',
        value: this.locationLabel([report.parishName, report.municipalityName, report.stateName], 'Sin sector asociado'),
      },
      { label: 'Ubicación', value: this.formatPoint(report.location) },
      { label: 'Estado', value: this.formatEnum(report.status) },
      { label: 'Fecha de envío', value: this.formatEventDate(report.submittedAt) },
      { label: 'Imágenes', value: `${photoCount} imagen${photoCount === 1 ? '' : 'es'} enviada${photoCount === 1 ? '' : 's'}` },
      { label: 'Detalle', value: this.truncateForDialog(report.description || 'Sin detalle adicional') },
    ];

    if (report.reporterDisplayName?.trim()) {
      details.splice(2, 0, { label: 'Reportante', value: report.reporterDisplayName.trim() });
    }
    if (report.reporterContact?.trim()) {
      details.splice(3, 0, { label: 'Contacto', value: report.reporterContact.trim() });
    }
    if (report.assignedReliefCenterName?.trim()) {
      details.splice(details.length - 1, 0, { label: 'Punto asignado', value: report.assignedReliefCenterName.trim() });
    }
    return details;
  }

  private buildCreateReliefCenterChangeDetails(change: TechnicalFileChange): Array<{ label: string; value: string }> {
    const international = this.changePayloadBoolean(change, 'international');
    const point = this.changePayloadPoint(change);
    const photoCount = this.changePayloadPhotos(change).length;
    const reference = international
      ? this.locationLabel(
        [this.changePayloadText(change, 'countryName'), this.changePayloadText(change, 'internationalAddressText')],
        'Sin dirección internacional',
      )
      : (this.changePayloadText(change, 'addressText') || 'Sin referencia');

    return [
      { label: 'Tipo', value: this.formatEnum(this.changePayloadText(change, 'centerType')) },
      { label: 'Nombre', value: this.changePayloadText(change, 'name') || 'Nuevo punto de apoyo' },
      { label: 'Alcance', value: international ? 'Internacional' : 'Nacional' },
      { label: 'Referencia', value: reference },
      { label: 'Ubicación', value: international ? 'No se ubica en mapa' : this.formatPoint(point) },
      { label: 'Teléfono', value: this.changePayloadText(change, 'contactPhone') || 'Sin teléfono reportado' },
      { label: 'Imágenes', value: `${photoCount} imagen${photoCount === 1 ? '' : 'es'} enviada${photoCount === 1 ? '' : 's'}` },
      { label: 'Detalle', value: this.truncateForDialog(this.changePayloadText(change, 'description') || 'Sin detalle adicional') },
    ];
  }

  private changePayloadBoolean(change: TechnicalFileChange, key: string): boolean {
    const value = change.proposedPayload[key];
    return value === true || String(value).toLowerCase() === 'true';
  }

  protected formatPoint(point: GeoPoint | null | undefined): string {
    if (!point) {
      return 'Sin ubicación en mapa';
    }
    return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
  }

  protected formatDistance(value?: number): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value < 1000) {
      return `${Math.round(value)} m`;
    }
    return `${(value / 1000).toFixed(1)} km`;
  }

  protected formatEnum(value?: string): string {
    const labels: Record<Language, Record<string, string>> = {
      es: {
        ACTIVE: 'Activo',
        ANIMAL_SHELTER: 'Refugio animal',
        APPROVED: 'Aprobado',
        ASSIGNED: 'Asignado',
        AVAILABLE: 'Disponible',
        BASELINE: 'Base inicial',
        CLOSED: 'Cerrado',
        COLLECTION_CENTER: 'Centro de acopio',
        CONVERTED: 'Publicado',
        CRITICAL: 'Crítica',
        DISCARDED: 'Descartado',
        DONATION_CENTER: 'Centro de acopio',
        DUPLICATE: 'Duplicado',
        FIELD_HOSPITAL: 'Hospital de campaña',
        HIGH: 'Alta',
        IN_REVIEW: 'En revisión',
        LIMITED: 'Limitado',
        LOCAL: 'Local',
        LOW: 'Baja',
        MEDICAL_POINT: 'Punto médico',
        MEDIUM: 'Media',
        MINOR: 'Daño leve',
        MODERATE: 'Daño estructural',
        NATIONAL: 'Nacional',
        NONE_VISIBLE: 'Sin daño visible',
        OPERATIONS_BASE: 'Base operativa',
        PARTIAL_COLLAPSE: 'Derrumbe parcial',
        PENDING: 'Pendiente',
        PENDING_ASSESSMENT: 'Pendiente de evaluación',
        PENDING_REVIEW: 'Pendiente de revisión',
        PEOPLE_SHELTER: 'Refugio de personas',
        PUBLIC: 'Público',
        RECEIVED: 'Recibido',
        REJECTED: 'Rechazado',
        RESTRICTED: 'Acceso restringido',
        SHELTER: 'Refugio',
        SEVERE: 'Daño severo',
        STATE: 'Estatal',
        SUPPLY_POINT: 'Punto de insumos',
        TEMPORARILY_CLOSED: 'Cerrado temporalmente',
        TOTAL_COLLAPSE: 'Derrumbe total',
        UNKNOWN: 'Por confirmar',
        UNVERIFIED: 'Sin verificar',
        VERIFIED: 'Verificado',
        VETERINARY_SUPPORT: 'Apoyo veterinario',
      },
      en: {
        ACTIVE: 'Active',
        ANIMAL_SHELTER: 'Animal shelter',
        APPROVED: 'Approved',
        ASSIGNED: 'Assigned',
        AVAILABLE: 'Available',
        BASELINE: 'Baseline',
        CLOSED: 'Closed',
        COLLECTION_CENTER: 'Supply center',
        CONVERTED: 'Published',
        CRITICAL: 'Critical',
        DISCARDED: 'Discarded',
        DONATION_CENTER: 'Supply center',
        DUPLICATE: 'Duplicate',
        FIELD_HOSPITAL: 'Field hospital',
        HIGH: 'High',
        IN_REVIEW: 'In review',
        LIMITED: 'Limited',
        LOCAL: 'Local',
        LOW: 'Low',
        MEDICAL_POINT: 'Medical point',
        MEDIUM: 'Medium',
        MINOR: 'Minor damage',
        MODERATE: 'Structural damage',
        NATIONAL: 'National',
        NONE_VISIBLE: 'No visible damage',
        OPERATIONS_BASE: 'Operations base',
        PARTIAL_COLLAPSE: 'Partial collapse',
        PENDING: 'Pending',
        PENDING_ASSESSMENT: 'Pending assessment',
        PENDING_REVIEW: 'Pending review',
        PEOPLE_SHELTER: 'People shelter',
        PUBLIC: 'Public',
        RECEIVED: 'Received',
        REJECTED: 'Rejected',
        RESTRICTED: 'Restricted access',
        SHELTER: 'Shelter',
        SEVERE: 'Severe damage',
        STATE: 'State',
        SUPPLY_POINT: 'Supply point',
        TEMPORARILY_CLOSED: 'Temporarily closed',
        TOTAL_COLLAPSE: 'Total collapse',
        UNKNOWN: 'To be confirmed',
        UNVERIFIED: 'Unverified',
        VERIFIED: 'Verified',
        VETERINARY_SUPPORT: 'Veterinary support',
      },
    };
    const clean = value || '';
    return labels[this.language()][clean] ?? clean.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (text) => text.toUpperCase());
  }

  protected moduleMaterialIcon(module: ModuleKey): string {
    const icons: Record<ModuleKey, string> = {
      reporte: 'edit_location_alt',
      sismos: 'monitor_heart',
      edificios: 'apartment',
      'mapas-dano': 'travel_explore',
      'centros-acopio': 'inventory_2',
      'refugios-personas': 'home_health',
      'refugios-animales': 'pets',
      'numeros-emergencia': 'phone_in_talk',
      'mapa-cartografico': 'terrain',
      'terminos-uso': 'policy',
      contacto: 'person_add',
      aprobar: 'fact_check',
      perfil: 'account_circle',
    };
    return icons[module];
  }

  protected damageColor(damageLevel?: string, severity?: string): string {
    const damage = damageLevel || '';
    if (['TOTAL_COLLAPSE', 'PARTIAL_COLLAPSE'].includes(damage)) {
      return '#d93025';
    }
    if (['SEVERE', 'MODERATE'].includes(damage)) {
      return '#fa7b17';
    }
    if (['MINOR', 'NONE_VISIBLE'].includes(damage)) {
      return '#fbbc04';
    }
    return this.severityColor(severity || 'MEDIUM');
  }
  protected formatEventDate(value?: string): string {
    if (!value) {
      return '';
    }
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0)
      : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const months = this.language() === 'en'
      ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    const datePart = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    if (dateOnly) {
      return datePart;
    }
    return `${datePart}. ${hours}:${minutes} ${suffix}`;
  }

  private addReportHistory(report: BackofficeIntakeReport, status: string, detail: string): void {
    this.reportModerationHistory.update((items) => [
      {
        id: report.id,
        title: report.structureName || 'Reporte sin estructura',
        status,
        detail,
        reviewedAt: new Date().toISOString(),
        actor: this.currentUser()?.username || 'moderador',
      },
      ...items.filter((item) => item.id !== report.id),
    ].slice(0, 30));
  }

  private addUserHistory(registration: UserRegistration, status: string): void {
    this.userModerationHistory.update((items) => [
      {
        id: registration.id,
        title: registration.fullName || registration.username,
        status,
        detail: `${registration.username} - ${registration.email}`,
        reviewedAt: new Date().toISOString(),
        actor: this.currentUser()?.username || 'administrador',
      },
      ...items.filter((item) => item.id !== registration.id),
    ].slice(0, 30));
  }

  private reviewReport(report: BackofficeIntakeReport, status: string, notes: string): void {
    const credentials = this.requireCredentials();
    if (!credentials) {
      return;
    }

    this.moderatingReportId.set(report.id);
    this.adminErrorMessage.set(null);
    const request = this.api.reviewIntakeReport(
      report.id,
      {
        status,
        moderationNotes: notes,
      },
      credentials,
    ).subscribe({
      next: (updated) => {
        this.moderatingReportId.set(null);
        this.intakeReports.update((items) => items.map((item) => item.id === report.id ? updated : item));
        if (status === 'REJECTED' || status === 'DUPLICATE') {
          this.addReportHistory(report, status, notes);
        }
        this.loadIntakeReports();
      },
      error: () => {
        this.moderatingReportId.set(null);
        this.adminErrorMessage.set('No pude actualizar el reporte seleccionado.');
      },
    });
    this.subscriptions.add(request);
  }

  private reviewTechnicalFileChange(change: TechnicalFileChange, approved: boolean): void {
    const credentials = this.requireCredentials();
    if (!credentials) {
      return;
    }

    this.moderatingChangeId.set(change.id);
    this.adminErrorMessage.set(null);
    const request = this.api.reviewTechnicalFileChange(
      change.id,
      {
        approved,
        moderationNotes: approved ? 'Cambio aprobado desde panel MVP.' : 'Cambio rechazado desde panel MVP.',
      },
      credentials,
    ).subscribe({
      next: () => {
        this.moderatingChangeId.set(null);
        this.statusMessage.set(`Cambio de ficha ${change.id} ${approved ? 'aprobado' : 'rechazado'}.`);
        this.loadTechnicalFileChanges(credentials);
        const file = this.selectedTechnicalFile();
        if (approved && change.changeType === 'DELETE') {
          this.closeTechnicalFile();
          this.loadNearby();
          return;
        }
        if (approved && change.changeType === 'LOCATION') {
          const point = this.changePayloadPoint(change);
          if (point) {
            this.setSelectedPoint(point, true);
          }
          this.loadNearby();
        }
        if (approved && change.changeType === 'CREATE_RELIEF_CENTER') {
          this.syncReliefCenterListAfterApproval(change);
        }
        if (approved && file) {
          this.reloadTechnicalFile(file);
        }
      },
      error: () => {
        this.moderatingChangeId.set(null);
        this.adminErrorMessage.set('No pude revisar el cambio de ficha seleccionado.');
      },
    });
    this.subscriptions.add(request);
  }

  private reviewUserRegistration(registration: UserRegistration, approved: boolean): void {
    const credentials = this.requireCredentials();
    if (!credentials || !this.isAdmin()) {
      return;
    }

    this.reviewingUserRegistrationId.set(registration.id);
    this.adminErrorMessage.set(null);
    const request = this.api.reviewUserRegistration(registration.id, approved, credentials).subscribe({
      next: (updated) => {
        this.reviewingUserRegistrationId.set(null);
        this.statusMessage.set(`Registro de ${registration.username} ${approved ? 'aprobado como moderador' : 'rechazado'}.`);
        this.userRegistrations.update((items) => items.map((item) => item.id === registration.id ? updated : item));
        this.addUserHistory(registration, approved ? 'APPROVED' : 'REJECTED');
        this.loadUserRegistrations(credentials);
      },
      error: () => {
        this.reviewingUserRegistrationId.set(null);
        this.adminErrorMessage.set('No pude revisar el registro seleccionado.');
      },
    });
    this.subscriptions.add(request);
  }

  private syncReliefCenterListAfterApproval(change: TechnicalFileChange): void {
    if (this.changePayloadText(change, 'centerType') === 'COLLECTION_CENTER') {
      this.donationScope.set(this.changePayloadBoolean(change, 'international') ? 'international' : 'national');
    }
    this.loadNearby(this.selectedPoint(), { preserveStatus: true });
  }

  private loadNearby(point = this.selectedPoint(), options: { preserveStatus?: boolean } = {}): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const request = forkJoin({
      zones: this.api.findAffectedZones(point, 1500000, 100),
      structures: this.api.findNearbyStructures(point, 1500000, 2000),
      reliefCenters: this.api.findReliefCenters(point, 1500000, 1000, { international: false }),
      internationalReliefCenters: this.api.findReliefCenters(undefined, 1500000, 1000, {
        acceptsDonations: true,
        international: true,
      }),
      seismicEvents: this.api.findSeismicEvents('2026-06-24T00:00:00', 2.5, 1000),
      emergencyContacts: this.api.findEmergencyContacts(200),
    }).subscribe({
      next: ({ zones, structures, reliefCenters, internationalReliefCenters, seismicEvents, emergencyContacts }) => {
        this.loading.set(false);
        this.zones.set(zones);
        this.structures.set(structures);
        this.reliefCenters.set([...reliefCenters, ...internationalReliefCenters]);
        this.seismicEvents.set(seismicEvents);
        this.emergencyContacts.set(emergencyContacts);
        if (!options.preserveStatus) {
          this.statusMessage.set(
            `${zones.length} zonas, ${structures.length} edificios, ${reliefCenters.length + internationalReliefCenters.length} refugios y ${seismicEvents.length} sismos cargados.`,
          );
        }
        this.renderLayers();
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se ha podido conectar con el servidor. Contacte al administrador.');
      },
    });
    this.subscriptions.add(request);
  }

  private setSelectedPoint(point: GeoPoint, moveMap: boolean, minimumZoom = 13): void {
    this.selectedPoint.set(point);
    this.closeMapPreview();
    if (moveMap && this.map) {
      this.focusMapOnPoint(point, Math.max(this.map.getZoom(), minimumZoom));
    }
    this.renderPosition();
  }

  private focusMapOnPoint(point: GeoPoint, zoom: number): void {
    if (!this.map) {
      return;
    }

    if (!this.isMobileViewport()) {
      this.map.setView([point.latitude, point.longitude], zoom);
      return;
    }

    const target = L.latLng(point.latitude, point.longitude);
    const mapSize = this.map.getSize();
    const mapRect = this.map.getContainer().getBoundingClientRect();
    const panel = document.querySelector('.context-panel') as HTMLElement | null;
    const topBar = document.querySelector('.top-bar') as HTMLElement | null;
    const panelTop = panel
      ? Math.max(0, Math.min(mapSize.y, panel.getBoundingClientRect().top - mapRect.top))
      : mapSize.y;
    const topLimit = topBar
      ? Math.max(0, topBar.getBoundingClientRect().bottom - mapRect.top + 16)
      : 72;
    const desiredY = Math.max(topLimit + 32, Math.min(panelTop - 56, (topLimit + panelTop) / 2));
    const projectedTarget = this.map.project(target, zoom);
    const desiredOffset = L.point(mapSize.x / 2 - mapSize.x / 2, desiredY - mapSize.y / 2);
    const center = this.map.unproject(projectedTarget.subtract(desiredOffset), zoom);
    this.map.setView(center, zoom);
  }

  private renderLayers(): void {
    this.zoneLayer.clearLayers();
    this.structureLayer.clearLayers();
    this.reliefLayer.clearLayers();
    this.seismicLayer.clearLayers();
    this.referenceLayer.clearLayers();

    for (const zone of this.visibleZonesForMap()) {
      L.circle([zone.center.latitude, zone.center.longitude], {
        radius: zone.radiusMeters,
        color: this.severityColor(zone.severity),
        fillColor: this.severityColor(zone.severity),
        fillOpacity: 0.12,
        weight: 2,
      })
        .bindPopup(`<strong>${this.escape(zone.name)}</strong><br>${this.formatEnum(zone.severity)} - ${this.formatEnum(zone.operationalStatus)}`)
        .addTo(this.zoneLayer);
    }

    for (const structure of this.visibleStructuresForMap()) {
      const marker = L.circleMarker([structure.location.latitude, structure.location.longitude], {
        radius: 7,
        color: '#202124',
        fillColor: this.damageColor(structure.currentDamageLevel, structure.currentSeverity),
        fillOpacity: 0.9,
        weight: 2,
        bubblingMouseEvents: false,
      });
      marker.on('mouseover', (event) => this.showStructurePreview(structure, event.latlng));
      marker.on('mouseout', () => this.scheduleCloseMapPreview());
      marker.on('click', (event) => this.showStructurePreview(structure, event.latlng));
      marker.addTo(this.structureLayer);
    }

    for (const center of this.visibleReliefCentersForMap()) {
      if (!center.location) {
        continue;
      }
      const marker = L.circleMarker([center.location.latitude, center.location.longitude], {
        radius: 8,
        color: '#ffffff',
        fillColor: this.reliefColor(center),
        fillOpacity: 0.95,
        weight: 2,
        bubblingMouseEvents: false,
      });
      marker.on('mouseover', (event) => this.showReliefPreview(center, event.latlng));
      marker.on('mouseout', () => this.scheduleCloseMapPreview());
      marker.on('click', (event) => this.showReliefPreview(center, event.latlng));
      marker.addTo(this.reliefLayer);
    }

    for (const event of this.visibleSeismicEventsForMap()) {
      if (!event.epicenter) {
        continue;
      }
      L.circleMarker([event.epicenter.latitude, event.epicenter.longitude], {
        radius: Math.min(18, Math.max(7, Number(event.magnitude || 3) * 2)),
        color: '#202124',
        fillColor: this.seismicColor(event.magnitude),
        fillOpacity: 0.78,
        weight: 2,
      })
        .bindPopup(`<strong>${this.escape(event.name)}</strong><br>M${event.magnitude ?? '?'} - ${this.escape(event.place)}`)
        .addTo(this.seismicLayer);
    }

    this.renderReferenceLayer();
    this.renderPosition();
  }

  private styleStreetTile(tile: HTMLElement): void {
    tile.style.filter = 'saturate(0.74) contrast(0.86) brightness(1.12) sepia(0.05)';
    tile.style.opacity = '0.94';
  }

  private renderReferenceLayer(): void {
    this.referenceLayer.clearLayers();
  }

  private renderPosition(): void {
    this.positionLayer.clearLayers();
    const point = this.selectedPoint();
    L.circleMarker([point.latitude, point.longitude], {
      radius: 8,
      color: '#ffffff',
      fillColor: '#1a73e8',
      fillOpacity: 1,
      weight: 3,
    })
      .bindPopup('Punto seleccionado')
      .addTo(this.positionLayer);
  }

  private visibleZonesForMap(): AffectedZone[] {
    return [];
  }

  private visibleStructuresForMap(): Structure[] {
    return this.isReliefFilterModule() ? [] : this.structures();
  }

  private visibleReliefCentersForMap(): ReliefCenter[] {
    const module = this.activeModule();
    if (module === 'centros-acopio') {
      return this.donationCenters();
    }
    if (module === 'refugios-personas') {
      return this.peopleReliefCenters();
    }
    if (module === 'refugios-animales') {
      return this.animalReliefCenters();
    }
    return this.reliefCenters().filter((center) => Boolean(center.location));
  }

  private visibleSeismicEventsForMap(): SeismicEvent[] {
    return this.isReliefFilterModule() ? [] : this.seismicEvents();
  }

  private isReliefFilterModule(): boolean {
    return ['centros-acopio', 'refugios-personas', 'refugios-animales'].includes(this.activeModule());
  }

  private searchCandidates(): SearchSuggestion[] {
    return [
      ...[...this.referencePoints, ...this.searchOnlyReferencePoints].map((reference) => ({
        label: reference.label,
        detail: reference.detail,
        point: reference.point,
        module: 'reporte' as ModuleKey,
        referencePoint: reference,
      })),
      ...this.zones().map((zone) => ({
        label: zone.name,
        detail: [zone.description, zone.municipalityName, zone.stateName].filter(Boolean).join(' · '),
        point: zone.center,
        module: 'reporte' as ModuleKey,
      })),
      ...this.structures().map((structure) => ({
        label: structure.name,
        detail: this.structureLocationLabel(structure),
        point: structure.location,
        module: 'edificios' as ModuleKey,
        structure,
      })),
      ...this.reliefCenters().filter((center): center is ReliefCenter & { location: GeoPoint } => Boolean(center.location)).map((center) => ({
        label: center.name,
        detail: `${this.reliefLocationLabel(center)} · ${this.formatEnum(center.centerType)}`,
        point: center.location,
        module: this.moduleForReliefCenter(center),
        reliefCenter: center,
      })),
    ];
  }

  private addressReferenceSuggestions(term: string): SearchSuggestion[] {
    const normalized = this.normalize(term);
    if (normalized.length < 2) {
      return [];
    }
    return this.searchCandidates()
      .map((candidate) => ({
        candidate,
        score: this.searchMatchScore(normalized, candidate),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map((entry) => entry.candidate);
  }

  private findBestSearchMatch(term: string): SearchSuggestion | undefined {
    const normalizedTerm = this.normalize(term);
    let bestMatch: SearchSuggestion | undefined;
    let bestScore = 0;

    for (const candidate of this.searchCandidates()) {
      const score = this.searchMatchScore(normalizedTerm, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestScore > 0 ? bestMatch : undefined;
  }

  private searchMatchScore(term: string, candidate: SearchSuggestion): number {
    const label = this.normalize(candidate.label);
    const detail = this.normalize(candidate.detail);
    const haystack = `${label} ${detail}`.trim();

    if (label === term) {
      return 1000;
    }
    if (label.startsWith(term)) {
      return 900;
    }
    if (label.includes(term)) {
      return 800;
    }
    if (haystack.includes(term)) {
      return 700;
    }

    const tokens = term.split(' ').filter((token) => token.length >= 3);
    if (tokens.length === 0) {
      return 0;
    }

    const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
    if (matchedTokens === 0) {
      return 0;
    }

    const coverage = matchedTokens / tokens.length;
    const labelBonus = tokens.some((token) => label.includes(token)) ? 120 : 0;
    return Math.round(coverage * 500) + labelBonus;
  }

  private proposedPointForAddressReference(match: SearchSuggestion, target: 'report' | 'relief'): GeoPoint {
    if (!this.shouldOffsetAddressReference(match)) {
      return match.point;
    }
    return this.nearbyProposalPoint(match.point, `${target}:${match.label}:${match.detail}`);
  }

  private shouldOffsetAddressReference(match: SearchSuggestion): boolean {
    return Boolean(match.structure || match.reliefCenter || match.referencePoint);
  }

  private referenceSelectionMessage(match: SearchSuggestion): string {
    if (!this.shouldOffsetAddressReference(match)) {
      return `Punto ajustado por referencia: ${match.label}.`;
    }
    return `Punto propuesto cerca de la referencia: ${match.label}. Puedes ajustarlo con un clic en el mapa.`;
  }

  private nearbyProposalPoint(base: GeoPoint, seed: string): GeoPoint {
    const angles = [25, 70, 115, 160, 205, 250, 295, 340];
    const radii = [28, 42];
    const start = Math.abs(this.hashString(seed)) % angles.length;
    const occupied = this.registeredReferencePoints();
    let bestPoint = this.offsetPoint(base, 32, angles[start]);
    let bestDistance = 0;

    for (const radius of radii) {
      for (let index = 0; index < angles.length; index += 1) {
        const angle = angles[(start + index) % angles.length];
        const candidate = this.offsetPoint(base, radius, angle);
        const nearestDistance = this.nearestDistanceMeters(candidate, occupied);
        if (nearestDistance > bestDistance) {
          bestDistance = nearestDistance;
          bestPoint = candidate;
        }
        if (nearestDistance >= 18) {
          return candidate;
        }
      }
    }

    return bestPoint;
  }

  private registeredReferencePoints(): GeoPoint[] {
    return [
      ...this.structures().map((structure) => structure.location),
      ...this.reliefCenters().map((center) => center.location).filter((point): point is GeoPoint => Boolean(point)),
      ...this.referencePoints.map((reference) => reference.point),
    ];
  }

  private nearestDistanceMeters(point: GeoPoint, points: GeoPoint[]): number {
    if (points.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.min(...points.map((current) => this.distanceMeters(point, current)));
  }

  private offsetPoint(base: GeoPoint, meters: number, angleDegrees: number): GeoPoint {
    const radians = angleDegrees * Math.PI / 180;
    const latitudeRadians = base.latitude * Math.PI / 180;
    const metersPerLatitudeDegree = 111_320;
    const metersPerLongitudeDegree = Math.max(1, metersPerLatitudeDegree * Math.cos(latitudeRadians));
    return {
      latitude: base.latitude + (Math.sin(radians) * meters) / metersPerLatitudeDegree,
      longitude: base.longitude + (Math.cos(radians) * meters) / metersPerLongitudeDegree,
    };
  }

  private distanceMeters(left: GeoPoint, right: GeoPoint): number {
    const earthRadiusMeters = 6_371_000;
    const leftLat = left.latitude * Math.PI / 180;
    const rightLat = right.latitude * Math.PI / 180;
    const deltaLat = (right.latitude - left.latitude) * Math.PI / 180;
    const deltaLng = (right.longitude - left.longitude) * Math.PI / 180;
    const haversine = Math.sin(deltaLat / 2) ** 2
      + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2;
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  private moduleForReliefCenter(center: ReliefCenter): ModuleKey {
    if (center.acceptsDonations || center.centerType === 'COLLECTION_CENTER') {
      return 'centros-acopio';
    }
    if (center.acceptsAnimals) {
      return 'refugios-animales';
    }
    return 'refugios-personas';
  }

  private showStructurePreview(structure: Structure, latlng: L.LatLng): void {
    this.setMapPreview(
      {
        kind: 'structure',
        title: structure.name,
        subtitle: `${this.formatEnum(structure.currentDamageLevel)} - ${this.formatEnum(structure.currentOperationalStatus)}`,
        caption: this.structureLocationLabel(structure),
        icon: 'apartment',
        color: this.damageColor(structure.currentDamageLevel, structure.currentSeverity),
        structure,
      },
      latlng,
    );
  }

  private showReliefPreview(center: ReliefCenter, latlng: L.LatLng): void {
    this.setMapPreview(
      {
        kind: 'relief',
        title: center.name,
        subtitle: `${this.formatEnum(center.centerType)} - ${this.formatEnum(center.status)}`,
        caption: this.reliefLocationLabel(center),
        icon: center.acceptsAnimals ? 'pets' : center.acceptsDonations ? 'inventory_2' : 'home_health',
        color: this.reliefColor(center),
        reliefCenter: center,
      },
      latlng,
    );
  }

  private setMapPreview(preview: Omit<MapPreview, 'x' | 'y'>, latlng: L.LatLng): void {
    this.keepMapPreview();
    const position = this.mapPreviewPosition(latlng);
    this.mapPreview.set({ ...preview, ...position });
  }

  private mapPreviewPosition(latlng: L.LatLng): { x: number; y: number } {
    if (!this.map) {
      return { x: window.innerWidth / 2, y: 160 };
    }
    const mapRect = this.map.getContainer().getBoundingClientRect();
    const point = this.map.latLngToContainerPoint(latlng);
    if (this.isMobileViewport()) {
      const panel = document.querySelector('.context-panel') as HTMLElement | null;
      const topBar = document.querySelector('.top-bar') as HTMLElement | null;
      const panelTop = panel ? panel.getBoundingClientRect().top : window.innerHeight - 150;
      const minY = topBar ? topBar.getBoundingClientRect().bottom + 74 : 150;
      const maxY = Math.max(minY, panelTop - 18);
      return {
        x: window.innerWidth / 2,
        y: Math.max(minY, Math.min(maxY, mapRect.top + point.y - 14)),
      };
    }
    return {
      x: Math.max(180, Math.min(window.innerWidth - 220, mapRect.left + point.x)),
      y: Math.max(158, Math.min(window.innerHeight - 90, mapRect.top + point.y - 14)),
    };
  }

  private locationLabel(parts: Array<string | undefined | null>, fallback: string): string {
    const uniqueParts: string[] = [];
    for (const rawPart of parts) {
      const part = rawPart?.trim();
      if (part && !uniqueParts.some((current) => this.normalize(current) === this.normalize(part))) {
        uniqueParts.push(part);
      }
    }
    return uniqueParts.join(' · ') || fallback;
  }

  private changePayloadPoint(change: TechnicalFileChange): GeoPoint | null {
    const longitude = Number(change.proposedPayload['longitude']);
    const latitude = Number(change.proposedPayload['latitude']);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return null;
    }
    return { longitude, latitude };
  }

  private reloadTechnicalFile(file: TechnicalFile): void {
    this.technicalFileLoading.set(true);
    const request = file.structure
      ? this.api.findStructureTechnicalFile(file.structure.id)
      : this.api.findReliefCenterTechnicalFile(file.reliefCenter!.id);
    const subscription = request.subscribe({
      next: (updatedFile) => {
        this.technicalFileLoading.set(false);
        this.selectedTechnicalFile.set(updatedFile);
        if (updatedFile.structure) {
          this.populateStructureEditForm(updatedFile.structure);
          this.populateStructureDescriptionForm(updatedFile.structure);
        }
      },
      error: () => {
        this.technicalFileLoading.set(false);
      },
    });
    this.subscriptions.add(subscription);
  }

  private shouldShowFirstVisitNotice(): boolean {
    try {
      return window.localStorage.getItem('earthcontrol.notice.v1') !== 'dismissed';
    } catch {
      return true;
    }
  }

  private requireCredentials(): BasicAuthCredentials | null {
    const credentials = this.credentials();
    if (!credentials) {
      this.adminErrorMessage.set('Inicia sesión en Perfil para usar el backoffice.');
      return null;
    }
    if (this.isCredentialsExpired(credentials)) {
      this.endSession('La sesión operativa venció. Inicia sesión nuevamente.');
      this.adminErrorMessage.set('La sesión expiró. Inicia sesión nuevamente.');
      return null;
    }
    return credentials;
  }

  private severityColor(severity: string): string {
    const colors: Record<string, string> = {
      LOW: '#188038',
      MEDIUM: '#fbbc04',
      HIGH: '#fa7b17',
      CRITICAL: '#d93025',
    };
    return colors[severity] ?? '#5f6368';
  }

  private reliefColor(center: ReliefCenter): string {
    if (center.acceptsAnimals) {
      return '#9334e6';
    }
    if (center.acceptsDonations) {
      return '#188038';
    }
    if (center.acceptsPeople) {
      return '#1a73e8';
    }
    return '#5f6368';
  }

  private seismicColor(magnitude?: number): string {
    const value = Number(magnitude || 0);
    if (value >= 5.5) {
      return '#d93025';
    }
    if (value >= 4) {
      return '#fa7b17';
    }
    return '#9334e6';
  }

  private emptyToNull(value: string): string | null {
    const clean = value.trim();
    return clean.length === 0 ? null : clean;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  protected isMobileViewport(): boolean {
    return this.mobileViewport();
  }

  private syncMobileViewport(): void {
    const isMobile = this.matchesMobileViewport();
    if (this.mobileViewport() === isMobile) {
      return;
    }
    this.mobileViewport.set(isMobile);
    if (!isMobile) {
      this.panelCollapsed.set(false);
    }
  }

  private matchesMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(this.mobileViewportQuery).matches;
  }

  private escape(value?: string): string {
    return String(value || '').replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return entities[char];
    });
  }
}
