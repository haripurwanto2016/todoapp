<script>
    import { createEventDispatcher } from "svelte";
    import { dataset_dev } from "svelte/internal";

    export let content, listName, index;
    const dispatch = createEventDispatcher();
    function handleDeleteCard() {
        dispatch("deleteCard", { index });
    }

    function handleMoveRight() {
        dispatch("moveRight", { index });
    }

    function handleMoveLeft() {
        dispatch("moveLeft", { index });
    }
</script>

<div>
    <div class="card mb-3 has-background-primary-light">
        <div class="card-content">
            <div class="columns">
                <div class="column is-1">
                    {#if listName != "Rencana"}
                        <span
                            class="icon has-text-primary"
                            on:click={handleMoveLeft}
                        >
                            L
                        </span>
                    {/if}
                </div>

                <div class="column is-9">{content}</div>

                <div class="column is-1" on:click={handleDeleteCard}>
                    <span class="icon has-text-danger"> D </span>
                </div>

                <div class="column is-1">
                    {#if listName != "Selesai"}
                        <span
                            class="icon has-text-primary"
                            on:click={handleMoveRight}
                        >
                            R
                        </span>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
