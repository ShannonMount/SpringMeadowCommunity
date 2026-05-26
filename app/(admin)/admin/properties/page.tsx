import {
  archiveAdminPropertyAction,
  createAdminPropertyAction,
  updateAdminPropertyAction,
} from "@/server/actions/admin-properties";
import {
  listAdminProperties,
  type AdminPropertyDelinquencyStatus,
  type AdminPropertyStatus,
  type AdminPropertySummary,
} from "@/server/services/admin/property-management";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const PAGE_SIZE = 100;
const MAX_PAGE_OFFSET = 10000;
const PROPERTY_STATUSES: AdminPropertyStatus[] = ["active", "inactive", "archived"];
const DELINQUENCY_STATUSES: AdminPropertyDelinquencyStatus[] = [
  "current",
  "due_soon",
  "overdue",
  "delinquent",
  "lien_review",
  "disputed",
];

type AdminPropertiesPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
    query?: string | string[];
    includeArchived?: string | string[];
    propertyAction?: string | string[];
    propertyActionField?: string | string[];
    pageOffset?: string | string[];
  }>;
};

type FieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: "text" | "date" | "search";
  inputMode?: "decimal" | "numeric" | "text";
  autoComplete?: string;
};

const inputClass =
  "min-h-10 rounded-sm border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-sm bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24483e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]";

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageOffset(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_OFFSET) : 0;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function adminPropertiesHref(input: {
  status?: string;
  query?: string;
  includeArchived: boolean;
  pageOffset: number;
}) {
  const params = new URLSearchParams();

  setOptionalParam(params, "status", input.status);
  setOptionalParam(params, "query", input.query);

  if (input.includeArchived) {
    params.set("includeArchived", "1");
  }

  if (input.pageOffset > 0) {
    params.set("pageOffset", String(input.pageOffset));
  }

  const queryString = params.toString();

  return queryString ? `/admin/properties?${queryString}` : "/admin/properties";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function dateValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actionNotice(value: string | undefined, field: string | undefined) {
  const notices: Record<string, string> = {
    created: "Property created.",
    updated: "Property updated.",
    archived: "Property archived.",
    invalid: "Check the property details and try again.",
    denied: "You do not have permission to manage properties.",
    unavailable: "Property management is temporarily unavailable.",
    conflict: "Another property already uses that account number or payment code.",
  };
  const message = value ? notices[value] : "";

  if (!message) {
    return "";
  }

  return field ? `${message} Field: ${humanize(field)}.` : message;
}

function TextField({
  id,
  name,
  label,
  defaultValue,
  required,
  type = "text",
  inputMode,
  autoComplete,
}: FieldProps) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="break-words text-sm font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  options,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="break-words text-sm font-semibold text-[var(--foreground)]">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function MailingAddressFields({
  prefix,
  property,
}: {
  prefix: string;
  property?: AdminPropertySummary;
}) {
  const mailingAddress = property?.mailingAddress;

  return (
    <fieldset className="grid gap-3 border-t border-[var(--border)] pt-4">
      <legend className="mb-1 text-sm font-semibold text-[var(--foreground)]">
        Mailing address
      </legend>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <TextField
          id={`${prefix}-mailing-address-line1`}
          name="mailingAddressLine1"
          label="Mailing address line 1"
          defaultValue={mailingAddress?.line1}
        />
        <TextField
          id={`${prefix}-mailing-address-line2`}
          name="mailingAddressLine2"
          label="Mailing address line 2"
          defaultValue={mailingAddress?.line2}
        />
        <TextField
          id={`${prefix}-mailing-city`}
          name="mailingAddressCity"
          label="Mailing city"
          defaultValue={mailingAddress?.city}
        />
        <TextField
          id={`${prefix}-mailing-state`}
          name="mailingAddressState"
          label="Mailing state"
          defaultValue={mailingAddress?.state}
          autoComplete="address-level1"
        />
        <TextField
          id={`${prefix}-mailing-postal-code`}
          name="mailingAddressPostalCode"
          label="Mailing postal code"
          defaultValue={mailingAddress?.postalCode}
          autoComplete="postal-code"
        />
        <TextField
          id={`${prefix}-mailing-county`}
          name="mailingAddressCounty"
          label="Mailing county"
          defaultValue={mailingAddress?.county}
        />
      </div>
    </fieldset>
  );
}

function PropertyFields({
  prefix,
  property,
}: {
  prefix: string;
  property?: AdminPropertySummary;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <TextField
          id={`${prefix}-account-number`}
          name="accountNumber"
          label="Account number"
          defaultValue={property?.accountNumber}
          required
        />
        <TextField
          id={`${prefix}-public-payment-code`}
          name="publicPaymentCode"
          label="Public payment code"
          defaultValue={property?.publicPaymentCode}
        />
        <SelectField
          id={`${prefix}-status`}
          name="status"
          label="Status"
          options={PROPERTY_STATUSES}
          defaultValue={property?.status ?? "active"}
        />
        <SelectField
          id={`${prefix}-delinquency-status`}
          name="delinquencyStatus"
          label="Delinquency status"
          options={DELINQUENCY_STATUSES}
          defaultValue={property?.delinquencyStatus ?? "current"}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <TextField
          id={`${prefix}-address-line1`}
          name="addressLine1"
          label="Address line 1"
          defaultValue={property?.addressLine1}
          required
          autoComplete="address-line1"
        />
        <TextField
          id={`${prefix}-address-line2`}
          name="addressLine2"
          label="Address line 2"
          defaultValue={property?.addressLine2}
          autoComplete="address-line2"
        />
        <TextField
          id={`${prefix}-city`}
          name="city"
          label="City"
          defaultValue={property?.city}
          required
          autoComplete="address-level2"
        />
        <TextField
          id={`${prefix}-state`}
          name="state"
          label="State"
          defaultValue={property?.state ?? "NC"}
          required
          autoComplete="address-level1"
        />
        <TextField
          id={`${prefix}-postal-code`}
          name="postalCode"
          label="Postal code"
          defaultValue={property?.postalCode}
          required
          autoComplete="postal-code"
        />
        <TextField
          id={`${prefix}-county`}
          name="county"
          label="County"
          defaultValue={property?.county}
        />
        <TextField
          id={`${prefix}-owner-display-name`}
          name="ownerDisplayName"
          label="Owner display name"
          defaultValue={property?.ownerDisplayName}
        />
        <TextField
          id={`${prefix}-next-due-date`}
          name="nextDueDate"
          label="Next due date"
          type="date"
          defaultValue={dateValue(property?.nextDueDate ?? null)}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <TextField
          id={`${prefix}-lot-number`}
          name="lotNumber"
          label="Lot number"
          defaultValue={property?.lotNumber}
        />
        <TextField
          id={`${prefix}-parcel-number`}
          name="parcelNumber"
          label="Parcel number"
          defaultValue={property?.parcelNumber}
        />
        <TextField
          id={`${prefix}-plat-reference`}
          name="platReference"
          label="Plat reference"
          defaultValue={property?.platReference}
        />
      </div>
      <MailingAddressFields prefix={prefix} property={property} />
    </div>
  );
}

function Filters({
  status,
  query,
  includeArchived,
}: {
  status?: string;
  query?: string;
  includeArchived: boolean;
}) {
  return (
    <form className="mt-6 grid gap-3 border-y border-[var(--border)] py-4 md:grid-cols-[180px_1fr_auto] md:items-end">
      <div className="grid min-w-0 gap-1">
        <label htmlFor="status" className="text-xs font-semibold uppercase text-[var(--accent)]">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">Active and inactive</option>
          {PROPERTY_STATUSES.map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
      </div>
      <TextField
        id="query"
        name="query"
        label="Search"
        type="search"
        defaultValue={query ?? ""}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-10 items-center gap-2 rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
          <input
            type="checkbox"
            name="includeArchived"
            value="1"
            defaultChecked={includeArchived}
            className="size-4 accent-[var(--accent)]"
          />
          Include archived
        </label>
        <button type="submit" className={buttonClass}>
          Apply filters
        </button>
      </div>
    </form>
  );
}

function CreatePropertyForm() {
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">Create property</h2>
      <form action={createAdminPropertyAction} className="mt-5 grid gap-4">
        <PropertyFields prefix="create-property" />
        <div>
          <button type="submit" className={buttonClass}>
            Create property
          </button>
        </div>
      </form>
    </section>
  );
}

function PropertyMeta({ property }: { property: AdminPropertySummary }) {
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-4">
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Balance</dt>
        <dd className="mt-1 break-words text-[var(--foreground)]">
          {formatCurrency(property.currentBalanceCents)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Last payment</dt>
        <dd className="mt-1 break-words text-[#4f5f5a]">{formatDate(property.lastPaymentAt)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Next due</dt>
        <dd className="mt-1 break-words text-[#4f5f5a]">{formatDate(property.nextDueDate)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase text-[var(--accent)]">Delinquency</dt>
        <dd className="mt-1 break-words text-[#4f5f5a]">
          {humanize(property.delinquencyStatus)}
        </dd>
      </div>
    </dl>
  );
}

function PropertyRow({ property }: { property: AdminPropertySummary }) {
  const propertyId = `property-${property.id}`;
  const address = [property.addressLine1, property.addressLine2, property.city, property.state, property.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <li id={propertyId} className="min-w-0 rounded-sm border border-[var(--border)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-lg font-semibold text-[var(--foreground)]">
              {property.accountNumber}
            </h3>
            <span className="rounded-sm border border-[var(--border)] px-2 py-1 text-xs font-semibold uppercase text-[var(--accent)]">
              {humanize(property.status)}
            </span>
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-[#4f5f5a]">{address}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[#4f5f5a]">
            Public payment code: {property.publicPaymentCode ?? "Not set"}
          </p>
          <p className="break-words text-sm leading-6 text-[#4f5f5a]">
            Owner: {property.ownerDisplayName ?? "Not set"}
          </p>
        </div>
        <form action={archiveAdminPropertyAction} className="flex items-start">
          <input type="hidden" name="propertyId" value={property.id} />
          <button
            type="submit"
            disabled={property.status === "archived"}
            className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:text-[#8a9792]`}
          >
            Archive
          </button>
        </form>
      </div>
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <PropertyMeta property={property} />
      </div>
      <details className="mt-4 border-t border-[var(--border)] pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
          Edit property
        </summary>
        <form action={updateAdminPropertyAction} className="mt-4 grid gap-4">
          <input type="hidden" name="propertyId" value={property.id} />
          <PropertyFields prefix={propertyId} property={property} />
          <div>
            <button type="submit" className={buttonClass}>
              Update property
            </button>
          </div>
        </form>
      </details>
    </li>
  );
}

function PropertyList({ properties }: { properties: AdminPropertySummary[] }) {
  if (properties.length === 0) {
    return (
      <p className="mt-6 border-b border-[var(--border)] pb-6 text-sm leading-6 text-[#4f5f5a]">
        No properties found.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4">
      {properties.map((property) => (
        <PropertyRow key={property.id} property={property} />
      ))}
    </ul>
  );
}

function PaginationControls({
  status,
  query,
  includeArchived,
  pageOffset,
  hasNextPage,
}: {
  status?: string;
  query?: string;
  includeArchived: boolean;
  pageOffset: number;
  hasNextPage: boolean;
}) {
  const hasPreviousPage = pageOffset > 0;
  const disabledClass =
    "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[#8a9792]";

  if (!hasPreviousPage && !hasNextPage) {
    return null;
  }

  return (
    <nav aria-label="Property roster pages" className="mt-4 flex flex-wrap items-center gap-3">
      {hasPreviousPage ? (
        <a
          href={adminPropertiesHref({
            status,
            query,
            includeArchived,
            pageOffset: Math.max(pageOffset - PAGE_SIZE, 0),
          })}
          className={secondaryButtonClass}
        >
          Previous
        </a>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Previous
        </span>
      )}
      {hasNextPage ? (
        <a
          href={adminPropertiesHref({
            status,
            query,
            includeArchived,
            pageOffset: pageOffset + PAGE_SIZE,
          })}
          className={secondaryButtonClass}
        >
          Next
        </a>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Next
        </span>
      )}
    </nav>
  );
}

function PermissionState({ kind }: { kind: string }) {
  const message =
    kind === "permission-denied"
      ? "You do not have permission to manage properties."
      : "Not available for your role right now.";

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--foreground)]">
        Property management
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#4f5f5a]">{message}</p>
    </section>
  );
}

export default async function AdminPropertiesPage({ searchParams }: AdminPropertiesPageProps) {
  const params = await searchParams;
  const status = getSingleSearchParam(params?.status);
  const query = getSingleSearchParam(params?.query);
  const includeArchived =
    getSingleSearchParam(params?.includeArchived) === "1" || status === "archived";
  const pageOffset = parsePageOffset(getSingleSearchParam(params?.pageOffset));
  const propertyAction = getSingleSearchParam(params?.propertyAction);
  const propertyActionField = getSingleSearchParam(params?.propertyActionField);
  const result = await listAdminProperties({
    communitySlug: DEFAULT_COMMUNITY_SLUG,
    status,
    query,
    includeArchived,
    pageSize: PAGE_SIZE + 1,
    pageOffset,
  });

  if (result.kind !== "properties") {
    return <PermissionState kind={result.kind} />;
  }

  const visibleProperties = result.properties.slice(0, PAGE_SIZE);
  const hasNextPage = result.properties.length > PAGE_SIZE;

  return (
    <section>
      <p className="text-sm font-semibold uppercase text-[var(--accent)]">Admin</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-semibold text-[var(--foreground)]">
            Property management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f5f5a]">
            {visibleProperties.length} properties shown.
          </p>
        </div>
        <p aria-live="polite" className="min-h-6 text-sm leading-6 text-[#4f5f5a]">
          {actionNotice(propertyAction, propertyActionField)}
        </p>
      </div>
      <Filters status={status} query={query} includeArchived={includeArchived} />
      <PropertyList properties={visibleProperties} />
      <PaginationControls
        status={status}
        query={query}
        includeArchived={includeArchived}
        pageOffset={pageOffset}
        hasNextPage={hasNextPage}
      />
      <CreatePropertyForm />
    </section>
  );
}
