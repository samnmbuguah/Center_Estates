import { createNavigationContainerRef } from "@react-navigation/native";

/** Global navigation ref so the custom left drawer can switch top-level
 * sections (Projects / Account) from outside the navigator tree. */
export const navigationRef = createNavigationContainerRef();
