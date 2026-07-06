import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
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

type DrawerItemKey = ModuleKey | 'add-acopio' | 'add-refugio';
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
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
}

type ReportForm = FormGroup<{
  reporterDisplayName: FormControl<string>;
  reporterContact: FormControl<string>;
  structureName: FormControl<string>;
  description: FormControl<string>;
}>;

type AuthForm = FormGroup<{
  username: FormControl<string>;
  password: FormControl<string>;
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

type ReliefCreateForm = FormGroup<{
  reporterDisplayName: FormControl<string>;
  reporterContact: FormControl<string>;
  name: FormControl<string>;
  description: FormControl<string>;
  addressText: FormControl<string>;
  contactPhone: FormControl<string>;
}>;

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
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('moduleScroller') private moduleScroller?: ElementRef<HTMLDivElement>;

  private readonly api = inject(EarthControlApi);
  private readonly subscriptions = new Subscription();
  private readonly sessionStorageKey = 'earthcontrol.session.v1';
  private map?: L.Map;
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.TileLayer;
  private readonly zoneLayer = L.layerGroup();
  private readonly structureLayer = L.layerGroup();
  private readonly reliefLayer = L.layerGroup();
  private readonly seismicLayer = L.layerGroup();
  private readonly positionLayer = L.layerGroup();
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
      'drawer.add-refugio': 'Añadir Refugio',
      'mobile.refugios': 'Refugios',
      'mobile.more': 'Más',
      'preview.structure': 'Edificación',
      'preview.relief': 'Refugio o acopio',
      'panel.activePoint': 'Punto activo',
      'action.refresh': 'Actualizar',
      'metric.zones': 'Zonas',
      'metric.critical': 'Críticas',
      'metric.buildings': 'Edificios',
      'metric.shelters': 'Refugios',
      'metric.modal.title': 'Resumen de edificios',
      'metric.modal.close': 'Cerrar resumen',
      'metric.modal.total': 'Edificios visibles en el mapa',
      'metric.modal.collapsed': 'Derrumbado / parcial',
      'metric.modal.structural': 'Daño estructural',
      'metric.modal.light': 'Daño leve o superficial',
      'metric.modal.unknown': 'Por confirmar',
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
      'profile.note': 'El inicio de sesión es sólo para moderadores y administradores. Para consultar el mapa o enviar reportes anónimos no necesitas una cuenta.',
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
      'drawer.add-refugio': 'Add Shelter',
      'mobile.refugios': 'Shelters',
      'mobile.more': 'More',
      'preview.structure': 'Building',
      'preview.relief': 'Shelter or supply center',
      'panel.activePoint': 'Active point',
      'action.refresh': 'Refresh',
      'metric.zones': 'Zones',
      'metric.critical': 'Critical',
      'metric.buildings': 'Buildings',
      'metric.shelters': 'Shelters',
      'metric.modal.title': 'Building summary',
      'metric.modal.close': 'Close summary',
      'metric.modal.total': 'Visible buildings on map',
      'metric.modal.collapsed': 'Collapsed / partial collapse',
      'metric.modal.structural': 'Structural damage',
      'metric.modal.light': 'Minor or superficial damage',
      'metric.modal.unknown': 'To be confirmed',
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
      'profile.note': 'Sign-in is only for moderators and administrators. You do not need an account to consult the map or submit anonymous reports.',
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
    { key: 'add-refugio', label: 'Añadir Refugio', icon: 'add_home_work' },
  ];

  protected readonly activeModule = signal<ModuleKey>('reporte');
  protected readonly drawerOpen = signal(false);
  protected readonly language = signal<Language>('es');
  protected readonly noticeVisible = signal(this.shouldShowFirstVisitNotice());
  protected readonly reportGuideOpen = signal(false);
  protected readonly buildingSummaryOpen = signal(false);
  protected readonly registrationFormOpen = signal(false);
  protected readonly summaryCollapsed = signal(false);
  protected readonly panelCollapsed = signal(false);
  protected readonly mobileMapToolsOpen = signal(false);
  protected readonly mobileHelpToolsOpen = signal(false);
  protected readonly mapMode = signal<'map' | 'satellite'>('map');
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
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly contactSubmitting = signal(false);
  protected readonly registrationSubmitting = signal(false);
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
    this.reliefCenters().filter((center) => center.acceptsPeople),
  );
  protected readonly animalReliefCenters = computed(() =>
    this.reliefCenters().filter((center) => center.acceptsAnimals),
  );
  protected readonly donationCenters = computed(() =>
    this.reliefCenters().filter((center) => center.acceptsDonations),
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
  protected readonly photoSlots = [0, 1, 2];

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly reportForm: ReportForm = new FormGroup({
    reporterDisplayName: new FormControl('', { nonNullable: true }),
    reporterContact: new FormControl('', { nonNullable: true }),
    structureName: new FormControl('', { nonNullable: true }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(5000)],
    }),
  });
  protected readonly authForm: AuthForm = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
    reporterDisplayName: new FormControl('', { nonNullable: true }),
    reporterContact: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(180)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12), Validators.maxLength(5000)] }),
    addressText: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    contactPhone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
  });
  protected readonly needItemControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.restoreStoredSession();
  }

  ngAfterViewInit(): void {
    this.subscriptions.add(this.searchControl.valueChanges.subscribe((value) => this.searchTerm.set(value)));

    this.map = L.map('earth-control-map', {
      zoomControl: false,
      attributionControl: true,
    }).setView([this.selectedPoint().latitude, this.selectedPoint().longitude], 12);

    this.streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '(C) OpenStreetMap contributors, (C) CARTO',
    }).addTo(this.map);

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
    this.positionLayer.addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.setSelectedPoint({ longitude: event.latlng.lng, latitude: event.latlng.lat }, false);
      if (this.locationEditMode() && this.selectedTechnicalFile()) {
        this.statusMessage.set(`Punto propuesto seleccionado: ${this.formatPoint(this.selectedPoint())}.`);
      }
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
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

  protected setActiveModule(
    module: ModuleKey,
    options: { preserveReliefCreate?: boolean; preserveTechnicalFile?: boolean } = {},
  ): void {
    this.activeModule.set(module);
    this.drawerOpen.set(false);
    this.mobileMapToolsOpen.set(false);
    this.mobileHelpToolsOpen.set(false);
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

  protected toggleRegistrationForm(): void {
    this.registrationFormOpen.update((open) => !open);
  }

  protected moduleLabel(module: ModuleKey): string {
    return this.t(`module.${module}`);
  }

  protected drawerItemLabel(item: DrawerItem): string {
    if (item.key === 'add-acopio') {
      return this.t('drawer.add-acopio');
    }
    if (item.key === 'add-refugio') {
      return this.t('drawer.add-refugio');
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

    if (item.key === 'add-acopio' || item.key === 'add-refugio') {
      this.drawerOpen.set(false);
      this.openReliefCreateForm(item.key === 'add-acopio' ? 'COLLECTION_CENTER' : 'SHELTER');
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

  protected submitReport(): void {
    this.errorMessage.set(null);
    this.lastIntakeId.set(null);
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    const value = this.reportForm.getRawValue();
    const payload: PublicIntakeReportRequest = {
      reporterDisplayName: this.emptyToNull(value.reporterDisplayName),
      reporterContact: this.emptyToNull(value.reporterContact),
      structureName: this.emptyToNull(value.structureName),
      location: this.selectedPoint(),
      description: value.description.trim(),
    };

    this.openSubmitConfirmation({
      title: 'Confirmar reporte de edificación',
      message: this.canModerate()
        ? 'La edificación se publicará directamente en el mapa.'
        : 'El reporte será enviado a aprobación antes de publicarse.',
      details: [
        { label: 'Edificación', value: payload.structureName || 'Edificación reportada' },
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
        this.statusMessage.set(`Reporte ciudadano recibido con folio ${report.id}.`);
        this.reportForm.reset({
          reporterDisplayName: '',
          reporterContact: '',
          structureName: '',
          description: '',
        });
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('No se pudo enviar el reporte ciudadano.');
      },
    });
    this.subscriptions.add(request);
  }

  private createStructureFromReport(payload: PublicIntakeReportRequest, credentials: BasicAuthCredentials): void {
    const structurePayload: StructureCreateRequest = {
      name: payload.structureName?.trim() || 'Edificación reportada',
      structureType: 'BUILDING',
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
        this.submitting.set(false);
        this.lastIntakeId.set(null);
        this.structures.update((items) => [structure, ...items.filter((item) => item.id !== structure.id)]);
        this.renderLayers();
        this.reportForm.reset({
          reporterDisplayName: '',
          reporterContact: '',
          structureName: '',
          description: '',
        });
        this.statusMessage.set(`Edificación publicada directamente: ${structure.name}.`);
        this.selectStructure(structure);
      },
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set('No se pudo publicar la edificación directamente.');
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

  private openSubmitConfirmation(dialog: Omit<SubmitConfirmationDialog, 'confirmText' | 'cancelText'>): void {
    this.submitConfirmation.set({
      ...dialog,
      confirmText: 'Sí, enviar',
      cancelText: 'No, revisar',
    });
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
        this.contactMessage.set(`Sugerencia recibida con folio ${response.id}. Gracias por colaborar.`);
        this.contactForm.reset({ senderName: '', senderEmail: '', messageBody: '' });
      },
      error: () => {
        this.contactSubmitting.set(false);
        this.contactMessage.set('No pude enviar la sugerencia. Inténtalo nuevamente más tarde.');
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
        this.registrationMessage.set(`Registro recibido con folio ${registration.id}. Un administrador debe aprobarlo.`);
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
        this.registrationMessage.set('No pude enviar el registro. Revisa que usuario y correo no existan previamente.');
      },
    });
    this.subscriptions.add(request);
  }

  protected saveProfile(): void {
    this.adminErrorMessage.set(null);
    if (this.authForm.invalid) {
      this.authForm.markAllAsTouched();
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
        this.setActiveModule('aprobar');
      },
      error: () => {
        this.adminLoading.set(false);
        this.endSession();
        this.adminErrorMessage.set('No pude iniciar sesión. Revisa usuario, clave y backend.');
      },
    });
    this.subscriptions.add(request);
  }

  protected clearProfile(): void {
    this.endSession('Sesión operativa cerrada.');
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
    this.reviewReport(report, 'IN_REVIEW', 'Tomado para revisión desde DondeAyudoVenezuela.');
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
    this.setSelectedPoint(center.location, moveMap);
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
    this.reliefCreateForm.reset({
      reporterDisplayName: '',
      reporterContact: '',
      name: '',
      description: '',
      addressText: '',
      contactPhone: '',
    });
    this.setActiveModule(
      type === 'COLLECTION_CENTER' ? 'centros-acopio' : type === 'ANIMAL_SHELTER' ? 'refugios-animales' : 'refugios-personas',
      { preserveReliefCreate: true },
    );
  }

  protected cancelReliefCreate(): void {
    this.reliefCreateMode.set(null);
    this.reliefCreateForm.reset({
      reporterDisplayName: '',
      reporterContact: '',
      name: '',
      description: '',
      addressText: '',
      contactPhone: '',
    });
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
    if (this.reliefCreateForm.invalid) {
      this.reliefCreateForm.markAllAsTouched();
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
        { label: 'Ubicación', value: this.formatPoint(payload.location) },
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
      const request = this.api.createReliefCenter(payload, credentials).subscribe({
        next: (created) => {
          this.reliefSubmitting.set(false);
          this.cancelReliefCreate();
          this.reliefCenters.update((centers) => [created, ...centers]);
          this.selectReliefCenter(created);
          this.statusMessage.set(`${this.formatEnum(created.centerType)} publicado: ${created.name}.`);
        },
        error: () => {
          this.reliefSubmitting.set(false);
          this.errorMessage.set('No pude crear el refugio o centro de acopio con la sesión actual.');
        },
      });
      this.subscriptions.add(request);
      return;
    }

    const request = this.api.submitReliefCenterCreateChange(payload).subscribe({
      next: (change) => {
        this.reliefSubmitting.set(false);
        this.cancelReliefCreate();
        this.statusMessage.set(`Solicitud enviada a aprobación con folio ${change.id}.`);
      },
      error: () => {
        this.reliefSubmitting.set(false);
        this.errorMessage.set('No pude enviar la solicitud a aprobación.');
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
    return {
      name: value.name.trim(),
      description: value.description.trim(),
      centerType: type,
      location: this.selectedPoint(),
      addressText: value.addressText.trim() || null,
      contactPhone: value.contactPhone.trim() || null,
      contactNotes: value.contactPhone.trim() ? `Teléfono reportado: ${value.contactPhone.trim()}` : null,
      acceptsPeople: type === 'SHELTER',
      acceptsAnimals: type === 'ANIMAL_SHELTER',
      acceptsDonations: type === 'COLLECTION_CENTER',
      submitterDisplayName: value.reporterDisplayName.trim() || null,
      submitterContact: value.reporterContact.trim() || null,
      publicVisible: true,
    };
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
        this.statusMessage.set(`Insumo enviado a aprobación con folio ${change.id}.`);
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
        this.statusMessage.set(`Edición de insumo enviada a aprobación con folio ${change.id}.`);
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
        this.statusMessage.set(`Retiro de insumo enviado a aprobación con folio ${change.id}.`);
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
          this.statusMessage.set(`Foto enviada a aprobación con folio ${change.id}.`);
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
        this.statusMessage.set(`Ubicación enviada a aprobación con folio ${change.id}.`);
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
        this.statusMessage.set(`${this.t('delete.pending')} con folio ${change.id}.`);
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
    const request = this.api.convertIntakeReport(
      report.id,
      {
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
      next: () => {
        this.moderatingReportId.set(null);
        this.statusMessage.set(`Reporte ${report.id} aprobado y convertido.`);
        this.loadIntakeReports();
      },
      error: () => {
        this.moderatingReportId.set(null);
        this.adminErrorMessage.set('No pude aprobar el reporte seleccionado.');
      },
    });
    this.subscriptions.add(request);
  }

  protected approveTechnicalFileChange(change: TechnicalFileChange): void {
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

  protected formatPoint(point: GeoPoint): string {
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
      next: () => {
        this.moderatingReportId.set(null);
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
      next: () => {
        this.reviewingUserRegistrationId.set(null);
        this.statusMessage.set(`Registro de ${registration.username} ${approved ? 'aprobado como moderador' : 'rechazado'}.`);
        this.loadUserRegistrations(credentials);
      },
      error: () => {
        this.reviewingUserRegistrationId.set(null);
        this.adminErrorMessage.set('No pude revisar el registro seleccionado.');
      },
    });
    this.subscriptions.add(request);
  }

  private loadNearby(point = this.selectedPoint()): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const request = forkJoin({
      zones: this.api.findAffectedZones(point, 1500000, 100),
      structures: this.api.findNearbyStructures(point, 1500000, 2000),
      reliefCenters: this.api.findReliefCenters(point, 1500000, 1000),
      seismicEvents: this.api.findSeismicEvents('2026-06-24T00:00:00', 2.5, 1000),
      emergencyContacts: this.api.findEmergencyContacts(200),
    }).subscribe({
      next: ({ zones, structures, reliefCenters, seismicEvents, emergencyContacts }) => {
        this.loading.set(false);
        this.zones.set(zones);
        this.structures.set(structures);
        this.reliefCenters.set(reliefCenters);
        this.seismicEvents.set(seismicEvents);
        this.emergencyContacts.set(emergencyContacts);
        this.statusMessage.set(
          `${zones.length} zonas, ${structures.length} edificios, ${reliefCenters.length} refugios y ${seismicEvents.length} sismos cargados.`,
        );
        this.renderLayers();
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No se ha podido conectar con el servidor. Contacte al administrador.');
      },
    });
    this.subscriptions.add(request);
  }

  private setSelectedPoint(point: GeoPoint, moveMap: boolean): void {
    this.selectedPoint.set(point);
    this.closeMapPreview();
    if (moveMap && this.map) {
      this.focusMapOnPoint(point, Math.max(this.map.getZoom(), 13));
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

    this.renderPosition();
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
    const module = this.activeModule();
    if (['reporte', 'sismos', 'edificios'].includes(module)) {
      return this.zones();
    }
    return [];
  }

  private visibleStructuresForMap(): Structure[] {
    const module = this.activeModule();
    if (['reporte', 'edificios'].includes(module)) {
      return this.structures();
    }
    return [];
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
    if (module === 'reporte') {
      return this.reliefCenters();
    }
    return [];
  }

  private visibleSeismicEventsForMap(): SeismicEvent[] {
    const module = this.activeModule();
    if (['reporte', 'sismos'].includes(module)) {
      return this.seismicEvents();
    }
    return [];
  }

  private searchCandidates(): SearchSuggestion[] {
    return [
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
      ...this.reliefCenters().map((center) => ({
        label: center.name,
        detail: `${this.reliefLocationLabel(center)} · ${this.formatEnum(center.centerType)}`,
        point: center.location,
        module: this.moduleForReliefCenter(center),
        reliefCenter: center,
      })),
    ];
  }

  private findBestSearchMatch(term: string): SearchSuggestion | undefined {
    let bestMatch: SearchSuggestion | undefined;
    let bestScore = 0;

    for (const candidate of this.searchCandidates()) {
      const score = this.searchMatchScore(term, candidate);
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

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 1180px), (pointer: coarse) and (max-width: 1368px)').matches;
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
