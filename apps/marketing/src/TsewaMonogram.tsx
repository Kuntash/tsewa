type TsewaMonogramProps = {
  className?: string;
};

export function TsewaMonogram({ className }: TsewaMonogramProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" fill="#0d2c24" r="32" />
      <circle cx="32" cy="32" fill="none" r="25" stroke="#f3eddf" strokeWidth="2" />
      <path
        d="M19 20h26l1 9h-2c-2-5-5-6-10-6v23h6v2H24v-2h6V23c-5 0-8 1-10 6h-2l1-9Z"
        fill="#f3eddf"
      />
      <circle cx="49" cy="15" fill="#d66f48" r="4" />
    </svg>
  );
}
