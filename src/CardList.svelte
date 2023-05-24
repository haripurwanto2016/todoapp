<script>
    import { createEventDispatcher } from "svelte";
    import ToDoCard from "./ToDoCard.svelte";
    export let cards, listName;

    const dispatch = createEventDispatcher();
    let todo = "";

    function handleAddCard() {
        dispatch("addCard", { todo, listName });
        todo = "";
    }
    function handleDeleteCard(event) {
        let data = event.detail;
        dispatch("deleteCard", { index: data.index, listName });
    }

    function handleMoveRight(event) {
        let data = event.detail;
        dispatch("moveRight", { index: data.index, listName });
    }

    function handleMoveLeft() {
        let data = event.detail;
        dispatch("moveLeft",  { index: data.index, listName });
    }
</script>

<div class="column is-4">
    <div class="card has-background-light">
        <div class="card-header">
            <p class="card-header-title">{listName}</p>
        </div>
        <div class="card-content">
            {#each cards as card, index}
                <ToDoCard
                    content={card.todo}
                    {listName}
                    {index}
                    on:deleteCard={handleDeleteCard}
                    on:moveRight={handleMoveRight}
                    on:moveLeft={handleMoveLeft}
                />
            {/each}

            <input
                type="text"
                class="input is-primary mb-1"
                bind:value={todo}
            />
            <button on:click={handleAddCard} class="button is-primary"
                >Add girl</button
            >
        </div>
    </div>
</div>

<style>
</style>
